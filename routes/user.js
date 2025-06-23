const express = require('express');
const router = express.Router();
const Period = require('../models/Period');
const Meal = require('../models/Meal');
const User = require('../models/User');

// Ensure JSON body parsing for AJAX
router.use(express.json());

// View periods list
router.get('/', async (req, res) => {
    try {
        const periods = await Period.find().sort({ startDate: -1 });
        const activePeriod = periods.find(p => p.isActive);
        res.render('user/periods', { periods, activePeriod });
    } catch (error) {
        res.status(500).send('Server error');
    }
});

// View period details
router.get('/period/:id', async (req, res) => {
    try {
        const period = await Period.findById(req.params.id)
            .populate('leaderId');  // Make sure to populate leaderId
        const meals = await Meal.find({ periodId: req.params.id }).sort({ date: 1 });
        const periodStats = await period.calculatePeriodStatistics();
        
        res.render('user/period-details', { 
            period, 
            meals,
            periodStats,
            userId: req.session.userId // Add userId from session
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Server error');
    }
});

// Get meal summary (for image generation)
router.get('/meal/:id', async (req, res) => {
    try {
        const meal = await Meal.findById(req.params.id);
        res.render('user/meal-summary', { meal });
    } catch (error) {
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
        res.render('user/statistics', { periods, activePeriod, selectedPeriodId, statsData });
    } catch (error) {
        res.status(500).send('Failed to load statistics');
    }
});

// Share page
router.get('/share', async (req, res) => {
    try {
        const leaderId = req.session.userId;
        if (!leaderId) return res.redirect('/auth/login');

        const leader = await User.findById(leaderId);
        if (!leader) return res.status(404).send('Leader not found');
        
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
                        numbers: [row.num], 
                        note: row.note 
                    }));
                const totalRow = selectedPeriod.shareTable.find(row => row.name === 'Total');
                    if (totalRow) totalSum = totalRow.num;
                }

                const shareTableNames = participants.map(p => p.name);
                addableParticipants = allManagedParticipants.filter(p => !shareTableNames.includes(p.name));
            }
        }
        
        res.render('user/share', { 
            periods, 
            activePeriod, 
            selectedPeriodId, 
            selectedPeriod, 
            participants,
            totalSum,
            addableParticipants
        });
    } catch (error) {
        console.error("Share page error:", error);
        res.status(500).send('Failed to load share page');
    }
});

// Save share table data
router.post('/share/save', async (req, res) => {
    try {
        const { period } = req.query;
        const { data } = req.body;
        if (!period || !Array.isArray(data)) return res.json({ success: false, error: 'Invalid data' });
        const periodDoc = await Period.findById(period);
        if (!periodDoc) return res.json({ success: false, error: 'Period not found' });
        // Only allow the period maker
        if (!req.session.userId || periodDoc.leaderId.toString() !== req.session.userId.toString()) {
            return res.json({ success: false, error: 'Not authorized' });
        }
        periodDoc.shareTable = data;
        await periodDoc.save();
        res.json({ success: true });
    } catch (error) {
        res.json({ success: false, error: 'Server error' });
    }
});

// Add participant to a period's shareTable
router.post('/share/participants', async (req, res) => {
    const { name, periodId } = req.body;
    const leaderId = req.session.userId;

    if (!name || !periodId || !leaderId) {
        return res.status(400).redirect(req.get('referer') || '/user/share');
    }
    try {
        await Period.updateOne(
            { _id: periodId, leaderId: leaderId },
            { $addToSet: { shareTable: { name: name, num: 0, note: '' } } }
        );
        res.redirect(req.get('referer') || '/user/share');
    } catch (error) {
        console.error(error);
        res.status(500).redirect(req.get('referer') || '/user/share');
    }
});

// Delete participant from a period's shareTable
router.post('/share/participants/delete', async (req, res) => {
    const { name, periodId } = req.body;
    const leaderId = req.session.userId;

    if (!name || !periodId || !leaderId) {
        return res.status(400).redirect(req.get('referer') || '/user/share');
    }
    try {
        await Period.updateOne(
            { _id: periodId, leaderId: leaderId },
            { $pull: { shareTable: { name: name } } }
        );
        res.redirect(req.get('referer') || '/user/share');
    } catch (error) {
        console.error(error);
        res.status(500).redirect(req.get('referer') || '/user/share');
    }
});

module.exports = router;
