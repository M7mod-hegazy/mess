const express = require('express');
const router = express.Router();
const Period = require('../models/Period');
const Meal = require('../models/Meal');
const User = require('../models/User');

// Helper function to format validation errors
const formatErrors = (err) => {
    if (err.errors) {
        return Object.values(err.errors)
            .map(error => error.message)
            .join(', ');
    }
    return err.message;
};

// Leader dashboard with period statistics
router.get('/dashboard', async (req, res) => {
    try {
        const periods = await Period.find({ leaderId: req.session.userId })
            .sort({ startDate: -1 });
        const activePeriod = periods.find(p => p.isActive);
        const leader = await User.findById(req.session.userId);

        // Get meals and calculate period statistics
        let meals = [];
        let periodStats = null;
        if (activePeriod) {
            meals = await Meal.find({
                periodId: activePeriod._id,
                leaderId: req.session.userId
            }).sort({ date: -1 });
            periodStats = await activePeriod.calculatePeriodStatistics();
        }        res.render('leader/dashboard', {
            activePeriod,
            periods,
            meals,
            periodStats,
            participants: leader.managedParticipants,
            error: req.session.error,
            success: req.session.success
        });

        delete req.session.error;
        delete req.session.success;
    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).render('leader/dashboard', {
            error: 'Failed to load dashboard'
        });
    }
});

// Manage participants
router.post('/participants', async (req, res) => {
    try {
        const { name } = req.body;
        const leader = await User.findById(req.session.userId);
        
        // Add new participant
        leader.managedParticipants.push({ name });
        await leader.save();
        
        res.redirect('/leader/dashboard');
    } catch (error) {
        res.status(500).send('Server error');
    }
});

// Delete participant
router.post('/participants/delete', async (req, res) => {
    try {
        const { participantName } = req.body;
        const leader = await User.findById(req.session.userId);
        
        // Find and remove the participant by name
        const index = leader.managedParticipants.findIndex(p => p.name === participantName);
        if (index !== -1) {
            leader.managedParticipants.splice(index, 1);
            await leader.save();
        }
        
        res.redirect('/leader/dashboard');
    } catch (error) {
        res.status(500).send('Server error');
    }
});

// Get all periods for selection
router.get('/periods', async (req, res) => {
    try {
        const periods = await Period.find({ leaderId: req.session.userId })
            .sort({ startDate: -1 });
        res.json(periods);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch periods' });
    }
});

// Get period details
router.get('/period/:id', async (req, res) => {
    try {
        const period = await Period.findOne({
            _id: req.params.id,
            leaderId: req.session.userId
        });
        
        if (!period) {
            return res.status(404).json({ error: 'Period not found' });
        }

        await period.updateOthersCosts();
        res.json(period);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch period details' });
    }
});

// Edit period form
router.get('/period/:id/edit', async (req, res) => {
    try {
        const period = await Period.findOne({
            _id: req.params.id,
            leaderId: req.session.userId
        });

        if (!period) {
            req.session.error = 'Period not found';
            return res.redirect('/leader/dashboard');
        }

        const periodStats = await period.calculatePeriodStatistics();
        res.render('leader/edit-period', { period, periodStats });
    } catch (error) {
        req.session.error = 'Failed to load period';
        res.redirect('/leader/dashboard');
    }
});

// Update period
router.post('/period/:id', async (req, res) => {
    try {
        const { leaderName, startDate, endDate, description } = req.body;
        // Handle isActive checkbox
        const isActive = req.body.isActive === 'on' ? true : false;
        const period = await Period.findOneAndUpdate(
            { _id: req.params.id, leaderId: req.session.userId },
            { leaderName, startDate, endDate, description, isActive },
            { new: true, runValidators: true }
        );

        if (!period) {
            req.session.error = 'Period not found';
            return res.redirect('/leader/dashboard');
        }

        req.session.success = 'Period updated successfully';
        res.redirect('/leader/dashboard');
    } catch (error) {
        req.session.error = formatErrors(error);
        res.redirect(`/leader/period/${req.params.id}/edit`);
    }
});

// Add new meal or update existing meal
router.post(['/meal', '/meal/:id'], async (req, res) => {
    try {
        const { date, type, ingredients, participants, periodId } = req.body;
        
        // Validate period exists and belongs to leader
        const period = await Period.findOne({
            _id: periodId,
            leaderId: req.session.userId
        });

        if (!period) {
            req.session.error = 'Invalid period selected';
            return res.redirect('/leader/dashboard');
        }

        // Ensure ingredients is always an array
        const normalizedIngredients = Array.isArray(ingredients)
            ? ingredients
            : ingredients
                ? Object.values(ingredients).every(v => typeof v === 'object')
                    ? Object.values(ingredients)
                    : [ingredients]
                : [];
        // Format ingredients with type
        const formattedIngredients = normalizedIngredients.map(ing => ({
            name: ing.name || '',
            price: parseFloat(ing.price) || 0,
            ingredientType: ing.ingredientType || 'normal'
        })).filter(ing => ing.name && ing.price >= 0);

        // Get leader's participants for validation
        const leader = await User.findById(req.session.userId);
        const participantMap = new Map(
            leader.managedParticipants.map(p => [p._id.toString(), p.name])
        );

        // Format participants with contributions
        const formattedParticipants = Array.isArray(participants) ? 
            participants.map(p => {
                const participantName = participantMap.get(p.id);
                if (!participantName) return null;
                return {
                    name: participantName,
                    contribution: parseFloat(p.contribution) || 0
                };
            }).filter(p => p !== null) : [];

        if (formattedParticipants.length === 0) {
            req.session.error = 'At least one valid participant is required';
            return res.redirect('/leader/dashboard');
        }

        // Create a name for the meal if not provided
        const mealName = `${type.charAt(0).toUpperCase() + type.slice(1)} on ${new Date(date).toLocaleDateString()}`;

        const meal = new Meal({
            name: mealName,
            date,
            type,
            ingredients: formattedIngredients,
            participants: formattedParticipants,
            periodId,
            leaderId: req.session.userId
        });

        await meal.save();
        if (req.headers['content-type'] && req.headers['content-type'].includes('application/json')) {
            return res.json({ success: true, mealId: meal._id });
        }
        req.session.success = 'Meal added successfully';
        res.redirect('/leader/dashboard');
    } catch (error) {
        console.error('Add meal error:', error);
        const errorMessage = formatErrors(error);
        if (req.headers['content-type'] && req.headers['content-type'].includes('application/json')) {
            return res.status(400).json({ success: false, error: errorMessage });
        }
        req.session.error = errorMessage;
        res.redirect('/leader/dashboard');
    }
});

// Get meal form (new or edit) with period selection
router.get(['/meal/new', '/meal/:id/edit'], async (req, res) => {
    try {
        const leader = await User.findById(req.session.userId);
        const periods = await Period.find({ leaderId: req.session.userId })
            .sort({ startDate: -1 });
        
        let meal = null;
        if (req.params.id) {
            meal = await Meal.findOne({
                _id: req.params.id,
                leaderId: req.session.userId
            });
        }

        res.render('leader/edit-meal', {
            meal,
            periods,
            participants: leader.managedParticipants,
            activePeriod: periods.find(p => p.isActive)
        });
    } catch (error) {
        console.error('Error loading meal form:', error);
        req.session.error = 'Failed to load meal form';
        res.redirect('/leader/dashboard');
    }
});

// Get single meal details
router.get('/meal/:id', async (req, res) => {
    try {
        const leader = await User.findById(req.session.userId);
        const meal = await Meal.findOne({
            _id: req.params.id,
            leaderId: req.session.userId
        });

        if (!meal) {
            return res.status(404).json({ error: 'Meal not found' });
        }

        // Format the response data
        const response = {
            id: meal._id,
            date: meal.date,
            type: meal.type,
            ingredients: meal.ingredients.map(ing => ({
                name: ing.name,
                price: ing.price,
                ingredientType: ing.ingredientType
            })),
            participants: meal.participants.map(part => {
                // Try to find the participant's id by name
                const p = (leader && leader.managedParticipants) ? leader.managedParticipants.find(mp => mp.name === part.name) : null;
                return {
                    id: p ? p._id : undefined,
                    name: part.name,
                    contribution: part.contribution
                };
            }),
            normalTotalCost: meal.normalTotalCost,
            otherTotalCost: meal.otherTotalCost,
            totalCost: meal.totalCost
        };

        res.json(response);
    } catch (error) {
        console.error('Error fetching meal details:', error);
        res.status(500).json({ error: formatErrors(error) });
    }
});

// Update meal
router.put('/meal/:id', async (req, res) => {
    try {
        const meal = await Meal.findOne({
            _id: req.params.id,
            leaderId: req.session.userId
        });

        if (!meal) {
            return res.status(404).json({ error: 'Meal not found' });
        }

        // Get leader's participants for validation
        const leader = await User.findById(req.session.userId);
        const participantMap = new Map(
            leader.managedParticipants.map(p => [p._id.toString(), p.name])
        );

        // Format participants with contributions (same as POST)
        const participants = Array.isArray(req.body.participants) ?
            req.body.participants.map(p => {
                const participantName = participantMap.get(p.id);
                if (!participantName) return null;
                return {
                    name: participantName,
                    contribution: parseFloat(p.contribution) || 0
                };
            }).filter(p => p !== null) : [];

        if (participants.length === 0) {
            return res.status(400).json({ error: 'At least one valid participant is required' });
        }

        meal.date = new Date(req.body.date);
        meal.type = req.body.type;
        meal.ingredients = req.body.ingredients;
        meal.participants = participants;

        // Save the meal (pre-save hook will calculate costs)
        await meal.save();

        // Update period statistics
        const period = await Period.findById(meal.periodId);
        if (period) {
            await period.calculatePeriodStatistics();
        }

        res.json({
            message: 'Meal updated successfully',
            meal: {
                id: meal._id,
                date: meal.date,
                type: meal.type,
                ingredients: meal.ingredients,
                participants: meal.participants,
                normalTotalCost: meal.normalTotalCost,
                otherTotalCost: meal.otherTotalCost,
                totalCost: meal.totalCost
            }
        });
    } catch (error) {
        console.error('Error updating meal:', error);
        res.status(500).json({ error: formatErrors(error) });
    }
});

// Delete meal
router.delete('/meal/:id', async (req, res) => {
    try {
        const meal = await Meal.findOneAndDelete({
            _id: req.params.id,
            leaderId: req.session.userId
        });

        if (!meal) {
            return res.status(404).json({ error: 'Meal not found' });
        }

        res.json({ message: 'Meal deleted successfully' });
    } catch (error) {
        console.error('Delete meal error:', error);
        res.status(500).json({ error: 'Failed to delete meal' });
    }
});

// Register new period
router.post('/period', async (req, res) => {
    try {
        const { leaderName, startDate, endDate, description } = req.body;

        // Validate dates
        const start = new Date(startDate);
        const end = new Date(endDate);

        if (start > end) {
            req.session.error = 'End date must be after start date';
            return res.redirect('/leader/dashboard');
        }

        const period = new Period({
            leaderName: leaderName.trim(),
            startDate: start,
            endDate: end,
            description: description ? description.trim() : '',
            leaderId: req.session.userId,
            isActive: true
        });

        await period.save();
        req.session.success = 'Period created successfully';
        res.redirect('/leader/dashboard');
    } catch (error) {
        console.error('Period creation error:', error);
        req.session.error = formatErrors(error);
        res.redirect('/leader/dashboard');
    }
});

// End current period
router.post('/period/end', async (req, res) => {
    try {
        const { periodId } = req.body;
        await Period.findByIdAndUpdate(periodId, { isActive: false });
        res.redirect('/leader/dashboard');
    } catch (error) {
        res.status(500).send('Server error');
    }
});

// Generate period report
router.get('/period/:id/report', async (req, res) => {
    try {
        const period = await Period.findOne({
            _id: req.params.id,
            leaderId: req.session.userId
        });

        if (!period) {
            return res.status(404).send('Period not found');
        }

        const meals = await Meal.find({ periodId: period._id }).sort('date');
        const stats = await period.calculatePeriodStatistics();

        let report = `Period Report - ${period.leaderName}'s Period\n`;
        report += `${new Date(period.startDate).toLocaleDateString()} - ${new Date(period.endDate).toLocaleDateString()}\n\n`;
        
        // Period Summary
        report += `PERIOD SUMMARY\n`;
        report += `-------------\n`;
        report += `Duration: ${stats.periodLength} days\n`;
        report += `Total Meals: ${stats.totalMeals}\n`;
        report += `Total Cost: $${stats.totalCost.toFixed(2)}\n`;
        report += `Normal Costs: $${stats.totalNormalCost.toFixed(2)}\n`;
        report += `Other Costs: $${stats.totalOthersCost.toFixed(2)}\n\n`;

        // Meal Distribution
        report += `MEAL DISTRIBUTION\n`;
        report += `-----------------\n`;
        report += `Breakfast: ${stats.summary.breakfastCount}\n`;
        report += `Lunch: ${stats.summary.lunchCount}\n`;
        report += `Dinner: ${stats.summary.dinnerCount}\n`;
        report += `Other: ${stats.summary.otherCount}\n\n`;

        // Participant Summary
        report += `PARTICIPANT SUMMARY\n`;
        report += `------------------\n`;
        Object.entries(stats.participantStats).forEach(([name, data]) => {
            report += `${name}:\n`;
            report += `  Meals attended: ${data.mealCount}\n`;
            report += `  Normal costs: $${data.normalCosts.toFixed(2)}\n`;
            report += `  Other costs: $${data.otherCosts.toFixed(2)}\n`;
            report += `  Total share: $${data.totalCosts.toFixed(2)}\n\n`;
        });

        // Detailed Meal List
        report += `MEAL DETAILS\n`;
        report += `------------\n`;
        meals.forEach(meal => {
            report += `\n${meal.name} (${meal.type}) - ${new Date(meal.date).toLocaleDateString()}\n`;
            report += `Participants: ${meal.participants.map(p => p.name).join(', ')}\n`;
            report += `Normal ingredients cost: $${meal.normalTotalCost.toFixed(2)}\n`;
            report += `Other ingredients cost: $${meal.otherTotalCost.toFixed(2)}\n`;
            report += `Total meal cost: $${meal.totalCost.toFixed(2)}\n`;
            report += `Ingredients:\n`;
            meal.ingredients.forEach(ing => {
                report += `  - ${ing.name}: $${ing.price.toFixed(2)} (${ing.ingredientType})\n`;
            });
        });

        // Set headers for file download
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Content-Disposition', `attachment; filename=period-report-${period._id}.txt`);
        res.send(report);
    } catch (error) {
        console.error('Report generation error:', error);
        res.status(500).send('Failed to generate report');
    }
});

// Activate a period (set as active, all others inactive)
router.post('/period/:id/activate', async (req, res) => {
    try {
        const period = await Period.findById(req.params.id);
        if (!period) {
            req.session.error = 'Period not found';
            return res.redirect('/leader/dashboard');
        }
        period.isActive = true;
        await period.save();
        req.session.success = 'Period activated successfully';
        res.redirect('/leader/dashboard');
    } catch (error) {
        req.session.error = 'Failed to activate period';
        res.redirect('/leader/dashboard');
    }
});

module.exports = router;
