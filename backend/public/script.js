const API_URL = 'http://localhost:5000/api/investments';

// Toggle views
function showSection(sectionId, btnElement) {
  // Update view
  document.querySelectorAll('.view-section').forEach(sec => sec.classList.remove('active'));
  document.getElementById('sec-' + sectionId).classList.add('active');
  
  // Update nav buttons
  document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
  if (btnElement) btnElement.classList.add('active');

  // Load data if switching to dashboard
  if (sectionId === 'dashboard') {
    fetchInvestments();
  }
}

// Fetch investments
async function fetchInvestments() {
  const tbody = document.getElementById('investmentTableBody');
  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--text-muted)">Loading...</td></tr>';
  
  try {
    const res = await fetch(API_URL);
    const result = await res.json();
    
    if (result.success && result.data.length > 0) {
      tbody.innerHTML = result.data.map(inv => `
        <tr>
          <td style="font-family:var(--font-logo)">${inv.Investment_ID}</td>
          <td>${inv.Investment_type}</td>
          <td>$${parseFloat(inv.Amount).toLocaleString()}</td>
          <td>${inv.Date}</td>
          <td style="color:var(--primary)">+$${parseFloat(inv.Returns).toLocaleString()}</td>
          <td><span class="badge ${inv.Status.toLowerCase()}">${inv.Status}</span></td>
        </tr>
      `).join('');
    } else {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--text-muted)">No active investments found.</td></tr>';
    }
  } catch (error) {
    console.error('Failed to fetch investments:', error);
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#ef4444">Connection error. Could not reach server.</td></tr>';
  }
}

// Handle Form Submission
document.getElementById('newInvestmentForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const type = document.getElementById('invType').value;
  const amount = document.getElementById('invAmount').value;
  const msgBox = document.getElementById('formMsg');
  
  const submitBtn = e.target.querySelector('button');
  submitBtn.textContent = 'Processing...';
  submitBtn.disabled = true;

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        Investment_type: type,
        Amount: amount,
        Customer_ID: 53 // Updated to account 45's ID for your specific test
      })
    });
    
    const result = await res.json();
    if (res.ok && result.success) {
      msgBox.innerHTML = `<div style="margin-top:16px; color:var(--primary); padding:12px; background:rgba(74, 222, 128, 0.1); border-radius:8px;">✅ ${result.message} ID: ${result.data.Investment_ID}</div>`;
      e.target.reset();
    } else {
      msgBox.innerHTML = `<div style="margin-top:16px; color:#ef4444; padding:12px; background:rgba(239, 68, 68, 0.1); border-radius:8px;">❌ ${result.message || 'Investment failed'}</div>`;
    }
  } catch (error) {
    console.error('Submission error:', error);
    msgBox.innerHTML = `<div style="margin-top:16px; color:#ef4444; padding:12px; background:rgba(239, 68, 68, 0.1); border-radius:8px;">❌ Connection error.</div>`;
  }
  
  submitBtn.textContent = 'Lock Investment 🚀';
  submitBtn.disabled = false;
});

// Initialize on load
window.addEventListener('DOMContentLoaded', fetchInvestments);
