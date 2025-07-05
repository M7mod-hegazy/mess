const mongoose = require('mongoose');

const periodSchema = new mongoose.Schema({
    leaderName: {
        type: String,
        required: true,
        trim: true
    },
    startDate: {
        type: Date,
        required: true
    },
    endDate: {
        type: Date,
        required: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    leaderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    description: {
        type: String,
        trim: true
    },
    shareTable: [
        {
            name: String,
            num: String,
            note: String
        }
    ]
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Only one period can be active at a time globally
periodSchema.pre('save', async function(next) {
    if (this.isActive) {
        await this.constructor.updateMany(
            { _id: { $ne: this._id } },
            { isActive: false }
        );
    }
    next();
});

// Validations
periodSchema.pre('validate', function(next) {
    // Validate date range
    if (this.startDate && this.endDate && this.startDate > this.endDate) {
        this.invalidate('endDate', 'End date must be after start date');
    }
    
    // Allow past start dates - removed validation that prevented past dates
    // if (this.isNew) {
    //     const today = new Date();
    //     today.setHours(0, 0, 0, 0);
    //     
    //     if (this.startDate < today) {
    //         this.invalidate('startDate', 'Start date cannot be in the past');
    //     }
    // }
    
    next();
});

// Virtual for meals in this period
periodSchema.virtual('meals', {
    ref: 'Meal',
    localField: '_id',
    foreignField: 'periodId'
});

// Calculate period length in days
periodSchema.virtual('periodLength').get(function() {
    return Math.ceil((this.endDate - this.startDate) / (1000 * 60 * 60 * 24));
});

// Calculate and update others costs for the period
periodSchema.methods.updateOthersCosts = async function() {
    const meals = await mongoose.model('Meal').find({ periodId: this._id });
    let totalOthersCost = 0;
    let totalParticipantAppearances = 0;
    
    // For each meal, calculate:
    // 1. Sum of 'other' type ingredients
    // 2. Count participants when there are 'other' costs
    // Example:
    // Meal 1: 2 people, $20 other → add $20 to totalOtherCost, add 2 to participant count
    // Meal 2: 3 people, $15 other → add $15 to totalOtherCost, add 3 to participant count
    // Result: totalOtherCost = $35, participant count = 5
    meals.forEach(meal => {
        let mealOtherCost = meal.ingredients
            .filter(ing => ing.ingredientType === 'other')
            .reduce((sum, ing) => sum + ing.price, 0);
            
        // Only include this meal's participants if it has other costs
        if (mealOtherCost > 0) {
            totalOthersCost += mealOtherCost;
            totalParticipantAppearances += meal.participants.length;
        }
    });

    // Calculate firstCost = totalOtherCost / total participant appearances
    // Example: firstCost = $35 / 5 = $7 per appearance
    const firstCost = totalParticipantAppearances > 0 ? 
        totalOthersCost / totalParticipantAppearances : 0;

    return { 
        totalOthersCost,
        totalParticipantAppearances,
        firstCost
    };
};

// Calculate period statistics including other costs
periodSchema.methods.calculatePeriodStatistics = async function() {
    const meals = await mongoose.model('Meal').find({ periodId: this._id });
    const { totalOthersCost, firstCost } = await this.updateOthersCosts();

    // Initialize statistics object
    const stats = {
        totalNormalCost: 0,
        totalOthersCost,
        totalCost: 0,
        totalMeals: meals.length,
        periodLength: this.periodLength,
        participantStats: {},
        summary: {
            breakfastCount: 0,
            lunchCount: 0,
            dinnerCount: 0,
            otherCount: 0,
            averageMealCost: 0,
            averageParticipantsPerMeal: 0
        },
        firstCost
    };
    
    // Calculate per-participant statistics
    meals.forEach(meal => {
        // Calculate normal costs
        let mealNormalCost = meal.ingredients
            .filter(ing => ing.ingredientType === 'normal')
            .reduce((sum, ing) => sum + ing.price, 0);
        stats.totalNormalCost += mealNormalCost;

        // Calculate other costs for this meal
        let mealOtherCost = meal.ingredients
            .filter(ing => ing.ingredientType === 'other')
            .reduce((sum, ing) => sum + ing.price, 0);

        // Handle normal cost distribution
        const normalCostPerParticipant = meal.participants.length > 0 ? 
            mealNormalCost / meal.participants.length : 0;

        meal.participants.forEach(participant => {
            if (!stats.participantStats[participant.name]) {
                stats.participantStats[participant.name] = {
                    mealCount: 0,
                    mealsWithOtherCosts: 0,  // Count of meals with other costs this person joined
                    normalCosts: 0,
                    otherCosts: 0,
                    contributions: 0
                };
            }

            const participantStats = stats.participantStats[participant.name];
            
            // Track all meals for display
            participantStats.mealCount++;
            
            // Add normal costs share
            participantStats.normalCosts += normalCostPerParticipant;
            
            // Track contributions
            participantStats.contributions += participant.contribution;
            
            // Count this meal for other costs if it has any
            if (mealOtherCost > 0) {
                participantStats.mealsWithOtherCosts++;
            }
        });
    });
    
    // Calculate final statistics per participant
    Object.keys(stats.participantStats).forEach(name => {
        const participant = stats.participantStats[name];
        
        // Calculate other costs based on firstCost × number of meals with other costs
        // Example: If firstCost is $7 and they joined 2 meals with other costs
        // Their other costs share = $7 × 2 = $14
        participant.otherCosts = firstCost * participant.mealsWithOtherCosts;
        
        // Calculate total costs
        participant.totalCosts = participant.normalCosts + participant.otherCosts;
        
        // Clean up intermediate calculation data
        delete participant.mealsWithOtherCosts;
    });

    stats.totalCost = stats.totalNormalCost + stats.totalOthersCost;
    return stats;
};

module.exports = mongoose.model('Period', periodSchema);
