// Test script to check specific period
require('dotenv').config();
const mongoose = require('mongoose');
const Period = require('./models/Period');
const Meal = require('./models/Meal');

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/mes';
const PERIOD_ID = '6860074088fd05115bafb50a';

async function testPeriod() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('Connected to MongoDB successfully');

        console.log(`\nTesting period ID: ${PERIOD_ID}`);
        
        // Check if period exists
        const period = await Period.findById(PERIOD_ID);
        if (!period) {
            console.log('❌ Period not found');
            return;
        }
        
        console.log('✅ Period found:', {
            id: period._id,
            name: period.leaderName,
            startDate: period.startDate,
            endDate: period.endDate,
            isActive: period.isActive
        });

        // Check meals for this period
        const meals = await Meal.find({ periodId: PERIOD_ID });
        console.log(`\n📊 Found ${meals.length} meals for this period`);
        
        if (meals.length > 0) {
            console.log('Sample meal:', {
                id: meals[0]._id,
                name: meals[0].name,
                date: meals[0].date,
                type: meals[0].type,
                participants: meals[0].participants.length
            });
        }

        // Test calculatePeriodStatistics
        console.log('\n🧮 Testing calculatePeriodStatistics...');
        try {
            const stats = await period.calculatePeriodStatistics();
            console.log('✅ Statistics calculated successfully');
            console.log('Stats summary:', {
                totalMeals: stats.totalMeals,
                totalNormalCost: stats.totalNormalCost,
                totalOthersCost: stats.totalOthersCost,
                participantCount: Object.keys(stats.participantStats).length
            });
        } catch (statsError) {
            console.log('❌ Error calculating statistics:', statsError.message);
            console.log('Error stack:', statsError.stack);
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('Error stack:', error.stack);
    } finally {
        await mongoose.connection.close();
        console.log('\nConnection closed');
    }
}

testPeriod(); 