const express = require('express');
const router = express.Router();
const Period = require('../models/Period');
const Meal = require('../models/Meal');
const User = require('../models/User');

// Ensure JSON body parsing for AJAX
router.use(express.json());

// View periods list
router.get(['/', '/periods'], async (req, res) => {
    try {
        const periods = await Period.find().sort({ startDate: -1 });
        const activePeriod = periods.find(p => p.isActive);
        res.render('user/periods', { periods, activePeriod, user: res.locals.user });
    } catch (error) {
        console.error('Error fetching periods:', error);
        res.status(500).send('Server error');
    }
});

// View period details
router.get(['/period/:id', '/periods/:id'], async (req, res) => {
    try {
        const period = await Period.findById(req.params.id)
            .populate('leaderId');  // Make sure to populate leaderId
        
        if (!period) {
            return res.status(404).send('Period not found');
        }
        
        const meals = await Meal.find({ periodId: req.params.id }).sort({ date: 1 });
        const periodStats = await period.calculatePeriodStatistics();
        
        res.render('user/period-details', { 
            period, 
            meals,
            periodStats,
            userId: req.session.userId, // Add userId from session
            user: res.locals.user // Pass user for navbar
        });
    } catch (error) {
        console.error('Error fetching period details:', error);
        console.error('Period ID:', req.params.id);
        console.error('Error stack:', error.stack);
        res.status(500).send('Server error: ' + error.message);
    }
});

// Get meal summary (for image generation)
router.get('/meal/:id', async (req, res) => {
    try {
        const meal = await Meal.findById(req.params.id);
        res.render('user/meal-summary', { meal });
    } catch (error) {
        console.error('Error fetching meal summary:', error);
        res.status(500).send('Server error');
    }
});

// Statistics page
router.get('/statistics', async (req, res) => {
    try {
        // Gather all periods
        const periods = await Period.find().sort({ startDate: -1 });
        const activePeriod = periods.find(p => p.isActive);
        const selectedPeriodId = req.query.period || (activePeriod && activePeriod._id.toString());
        const selectedPeriod = periods.find(p => p._id.toString() === selectedPeriodId);
        let statsData = {};
        if (selectedPeriod) {
            const meals = await Meal.find({ periodId: selectedPeriod._id });
            // 1. Total costs
            const totalNormalCost = meals.reduce((sum, m) => sum + (m.normalTotalCost || 0), 0);
            const totalOtherCost = meals.reduce((sum, m) => sum + (m.otherTotalCost || 0), 0);
            const totalCost = meals.reduce((sum, m) => sum + (m.totalCost || 0), 0);
            // 2. Ingredient prices (aggregate by name)
            const ingredientMap = {};
            meals.forEach(meal => {
                (meal.ingredients || []).forEach(ing => {
                    if (!ingredientMap[ing.name]) ingredientMap[ing.name] = { name: ing.name, price: 0 };
                    ingredientMap[ing.name].price += ing.price;
                });
            });
            const ingredients = Object.values(ingredientMap);
            // 2b. Ingredient prices over time
            const ingredientPricesOverTime = {};
            meals.forEach(meal => {
                const dateStr = meal.date.toISOString().slice(0, 10);
                (meal.ingredients || []).forEach(ing => {
                    if (!ingredientPricesOverTime[ing.name]) ingredientPricesOverTime[ing.name] = [];
                    ingredientPricesOverTime[ing.name].push({ date: dateStr, price: ing.price });
                });
            });
            // 2c. Total costs over time
            const costsByDate = {};
            meals.forEach(meal => {
                const dateStr = meal.date.toISOString().slice(0, 10);
                if (!costsByDate[dateStr]) costsByDate[dateStr] = { date: dateStr, normal: 0, other: 0, total: 0 };
                costsByDate[dateStr].normal += meal.normalTotalCost || 0;
                costsByDate[dateStr].other += meal.otherTotalCost || 0;
                costsByDate[dateStr].total += meal.totalCost || 0;
            });
            const totalCostsOverTime = Object.values(costsByDate).sort((a, b) => a.date.localeCompare(b.date));
            // 3. Per-participant daily cost
            const participantMap = {};
            const dailyCostsByParticipant = {};
            const allDates = new Set();
            meals.forEach(meal => {
                const dateStr = meal.date.toISOString().slice(0, 10);
                (meal.participants || []).forEach(p => {
                    if (!participantMap[p.name]) participantMap[p.name] = { name: p.name };
                    if (!dailyCostsByParticipant[p.name]) dailyCostsByParticipant[p.name] = [];
                    dailyCostsByParticipant[p.name].push({ date: dateStr, cost: p.normalShare || (meal.normalTotalCost / meal.participants.length) });
                    allDates.add(dateStr);
                });
            });
            // Average daily cost for all participants
            const dailyCostsAll = Array.from(allDates).sort().map(date => {
                let total = 0, count = 0;
                meals.forEach(meal => {
                    const dateStr = meal.date.toISOString().slice(0, 10);
                    if (dateStr === date) {
                        (meal.participants || []).forEach(p => {
                            total += p.normalShare || (meal.normalTotalCost / meal.participants.length);
                            count++;
                        });
                    }
                });
                return { date, cost: count ? total / count : 0 };
            });
            const participants = Object.values(participantMap);
            statsData = {
                totalNormalCost,
                totalOtherCost,
                totalCost,
                ingredients,
                participants,
                dailyCostsByParticipant,
                dailyCostsAll,
                ingredientPricesOverTime,
                totalCostsOverTime
            };
        }
        res.render('user/statistics', { periods, activePeriod, selectedPeriodId, statsData, user: res.locals.user });
    } catch (error) {
        console.error('Error loading statistics:', error);
        res.status(500).send('Failed to load statistics');
    }
});

// Share page
router.get('/share', async (req, res) => {
    try {
        let leaderId = req.session.userId;
        let leader = null;
        
        // If no session userId, try to find the user from recent periods
        if (!leaderId) {
            console.log('Share page - No session userId, checking for Google user...');
            const allPeriods = await Period.find().sort({ createdAt: -1 }).limit(1);
            if (allPeriods.length > 0) {
                const recentPeriod = allPeriods[0];
                leader = await User.findById(recentPeriod.leaderId);
                leaderId = recentPeriod.leaderId;
                console.log('Share page - Found user from recent period:', leader ? leader._id : 'No user');
            }
        } else {
            leader = await User.findById(leaderId);
        }
        
        if (!leader) {
            console.log('Share page - No leader found, redirecting to login');
            return res.redirect('/auth/login');
        }
        
        console.log('Share page - Using leaderId:', leaderId);
        console.log('Share page - Leader managedParticipants:', leader.managedParticipants?.length || 0);
        
        const allManagedParticipants = leader.managedParticipants || [];

        const periods = await Period.find({ leaderId }).sort({ startDate: -1 });
        const activePeriod = periods.find(p => p.isActive);
        const selectedPeriodId = req.query.period || (activePeriod && activePeriod._id.toString());
        
        let selectedPeriod = null, participants = [], totalSum = 0, addableParticipants = [];

        if (selectedPeriodId) {
            selectedPeriod = await Period.findById(selectedPeriodId);
            if (selectedPeriod) {
                if (selectedPeriod.shareTable && selectedPeriod.shareTable.length > 0) {
                    participants = selectedPeriod.shareTable.filter(row => row.name !== 'Total').map(row => ({ 
                        name: row.name, 
                        num: row.num, 
                        note: row.note 
                    }));
                    const totalRow = selectedPeriod.shareTable.find(row => row.name === 'Total');
                    if (totalRow) totalSum = totalRow.num;
                }

                const shareTableNames = participants.map(p => p.name);
                addableParticipants = allManagedParticipants.filter(p => !shareTableNames.includes(p.name));
            }
        }
        
        console.log('Share page - Addable participants:', addableParticipants.length);
        console.log('Share page - participants:', participants);
        res.render('user/share', { 
            periods, 
            activePeriod, 
            selectedPeriodId, 
            selectedPeriod, 
            participants,
            totalSum,
            addableParticipants,
            allManagedParticipants,
            user: res.locals.user // Pass user for navbar
        });
    } catch (error) {
        console.error('Error loading share page:', error);
        res.status(500).send('Failed to load share page');
    }
});

// Save share table data
router.post('/share/save', async (req, res) => {
    try {
        console.log('Save share - Request received');
        console.log('Save share - Query:', req.query);
        console.log('Save share - Body:', req.body);
        console.log('Save share - Headers:', req.headers);
        
        const { period } = req.query;
        const { data } = req.body;
        
        console.log('Save share - Period:', period);
        console.log('Save share - Data:', data);
        
        if (!period || !Array.isArray(data)) {
            console.log('Save share - Invalid data received');
            return res.json({ success: false, error: 'Invalid data' });
        }
        
        const periodDoc = await Period.findById(period);
        if (!periodDoc) {
            console.log('Save share - Period not found:', period);
            return res.json({ success: false, error: 'Period not found' });
        }
        
        // Check authorization - allow both session users and period owner
        let userId = req.session.userId;
        
        // If no session userId, try to find the user from the period
        if (!userId) {
            console.log('Save share - No session userId, checking period...');
            userId = periodDoc.leaderId;
            console.log('Save share - Found userId from period:', userId);
        }
        
        // Only allow the period maker
        if (!userId || periodDoc.leaderId.toString() !== userId.toString()) {
            console.log('Save share - Not authorized. userId:', userId, 'period.leaderId:', periodDoc.leaderId);
            return res.json({ success: false, error: 'Not authorized' });
        }
        
        // Add total row to the data
        const totalSum = data.reduce((sum, item) => sum + (parseFloat(item.num) || 0), 0);
        const dataWithTotal = [...data, { name: 'Total', num: totalSum, note: '' }];
        
        console.log('Save share - Data with total:', dataWithTotal);
        
        periodDoc.shareTable = dataWithTotal;
        await periodDoc.save();
        
        console.log('Save share - Successfully saved share table');
        res.json({ success: true });
    } catch (error) {
        console.error('Save share - Error:', error);
        res.json({ success: false, error: 'Server error: ' + error.message });
    }
});

// Add participant to a period's shareTable
router.post('/share/participants', async (req, res) => {
    const { name, periodId } = req.body;
    let leaderId = req.session.userId;

    // If no session userId, try to find the user from the period
    if (!leaderId) {
        console.log('Add participant - No session userId, checking period...');
        try {
            const period = await Period.findById(periodId);
            if (period) {
                leaderId = period.leaderId;
                console.log('Add participant - Found leaderId from period:', leaderId);
            }
        } catch (err) {
            console.error('Add participant - Error finding period:', err);
        }
    }

    if (!name || !periodId || !leaderId) {
        console.log('Add participant - Missing data:', { name, periodId, leaderId });
        return res.status(400).redirect(req.get('referer') || '/user/share');
    }
    
    try {
        console.log('Add participant - Adding participant:', { name, periodId, leaderId });
        await Period.updateOne(
            { _id: periodId, leaderId: leaderId },
            { $addToSet: { shareTable: { name: name, num: 0, note: '' } } }
        );
        // Log the updated shareTable
        const updatedPeriod = await Period.findById(periodId);
        console.log('Add participant - Updated shareTable:', updatedPeriod.shareTable);
        res.redirect(req.get('referer') || '/user/share');
    } catch (error) {
        console.error('Add participant - Error:', error);
        res.status(500).redirect(req.get('referer') || '/user/share');
    }
});

// Delete participant from a period's shareTable
router.post('/share/participants/delete', async (req, res) => {
    const { name, periodId } = req.body;
    let leaderId = req.session.userId;

    // If no session userId, try to find the user from the period
    if (!leaderId) {
        console.log('Delete participant - No session userId, checking period...');
        try {
            const period = await Period.findById(periodId);
            if (period) {
                leaderId = period.leaderId;
                console.log('Delete participant - Found leaderId from period:', leaderId);
            }
        } catch (err) {
            console.error('Delete participant - Error finding period:', err);
        }
    }

    if (!name || !periodId || !leaderId) {
        console.log('Delete participant - Missing data:', { name, periodId, leaderId });
        return res.status(400).redirect(req.get('referer') || '/user/share');
    }
    
    try {
        console.log('Delete participant - Deleting participant:', { name, periodId, leaderId });
        await Period.updateOne(
            { _id: periodId, leaderId: leaderId },
            { $pull: { shareTable: { name: name } } }
        );
        console.log('Delete participant - Successfully deleted participant');
        res.redirect(req.get('referer') || '/user/share');
    } catch (error) {
        console.error('Delete participant - Error:', error);
        res.status(500).redirect(req.get('referer') || '/user/share');
    }
});

module.exports = router;
