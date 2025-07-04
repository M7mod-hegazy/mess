// Global counters
let ingredientCounter = 0;
let participantCounter = 0;

// Initialize data when document loads
document.addEventListener('DOMContentLoaded', () => {
    // Add initial rows if none exist
    if (!document.querySelector('.ingredient-row')) {
        addIngredient();
    }
    if (!document.querySelector('.participant-row')) {
        addParticipant();
    }
    updateTotals();
});

function addIngredient() {
    const list = document.getElementById('ingredientList');
    if (!list) return;

    const row = document.createElement('div');
    row.className = 'row mb-2 ingredient-row';
    row.innerHTML = `
        <div class="col-5">
            <input type="text" class="form-control" name="ingredients[${ingredientCounter}][name]" placeholder="اسم المكون" required>
        </div>
        <div class="col-3">
            <input type="number" class="form-control" name="ingredients[${ingredientCounter}][price]" step="0.01" min="0" required onchange="updateTotals()">
        </div>
        <div class="col-3">
            <select class="form-select" name="ingredients[${ingredientCounter}][ingredientType]" onchange="updateTotals()">
                <option value="normal">عادي</option>
                <option value="other">نثريات</option>
            </select>
        </div>
        <div class="col-1">
            <button type="button" class="btn btn-danger btn-sm" onclick="removeRow(this)">×</button>
        </div>
    `;
    list.appendChild(row);
    ingredientCounter++;
    updateTotals();
}

function addParticipant() {
    const list = document.getElementById('participantsList');
    if (!list || !window.participants) return;

    const row = document.createElement('div');
    row.className = 'row mb-2 participant-row';
    row.innerHTML = `
        <div class="col-8">
            <select class="form-select" name="participants[${participantCounter}][id]" required>
                ${window.participants.map(p => `<option value="${p._id}">${p.name}</option>`).join('')}
            </select>
        </div>
        <div class="col-3">
            <input type="number" class="form-control" name="participants[${participantCounter}][contribution]" 
                   step="0.01" min="0" value="0" required onchange="updateTotals()">
        </div>
        <div class="col-1">
            <button type="button" class="btn btn-danger btn-sm" onclick="removeRow(this)">×</button>
        </div>
    `;
    list.appendChild(row);
    participantCounter++;
    updateTotals();
}

function removeRow(button) {
    let row = button.closest('.row') || button.closest('.ingredient-row') || button.closest('.participant-row');
    if (row) {
        row.remove();
        updateTotals();
    }
}

function updateTotals() {
    let normalTotal = 0;
    let otherTotal = 0;

    document.querySelectorAll('.ingredient-row').forEach(row => {
        const price = parseFloat(row.querySelector('input[type="number"]').value) || 0;
        const type = row.querySelector('select').value;
        if (type === 'normal') normalTotal += price;
        else otherTotal += price;
    });

    // Update totals display
    document.getElementById('normalTotal').textContent = normalTotal.toFixed(2);
    document.getElementById('otherTotal').textContent = otherTotal.toFixed(2);
    document.getElementById('grandTotal').textContent = (normalTotal + otherTotal).toFixed(2);

    // Update per person cost
    const participantCount = document.querySelectorAll('.participant-row').length;
    if (participantCount > 0) {
        const perPerson = normalTotal / participantCount;
        document.getElementById('perPersonCost').textContent = perPerson.toFixed(2);
        updateParticipantShares(perPerson);
    }
}

function updateParticipantShares(amount) {
    document.querySelectorAll('.participant-row').forEach(row => {
        const input = row.querySelector('input[type="number"]');
        if (!input.value || parseFloat(input.value) === 0) {
            input.value = amount.toFixed(2);
        }
    });
}
