// =============================================
// ADMIN DASHBOARD - AUTHENTICATION & DATA
// =============================================

// Check authentication on page load
document.addEventListener('DOMContentLoaded', function() {
    checkAdminAuth();
    initializeDashboard();
});

// Check if admin is authenticated
function checkAdminAuth() {
    const adminAuth = sessionStorage.getItem('adminAuth');
    
    if (!adminAuth) {
        // Not authenticated, redirect to login
        alert('⚠️ Please login first');
        window.location.href = 'admin-login.html';
        return false;
    }
    
    try {
        const adminData = JSON.parse(adminAuth);
        
        // Display admin email in navbar
        document.getElementById('adminEmail').textContent = adminData.email;
        
        // Show the body (it's hidden by default in CSS)
        document.body.style.display = 'block';
        
        console.log('✅ Admin authenticated:', adminData.name);
        return true;
        
    } catch (error) {
        console.error('Authentication error:', error);
        sessionStorage.removeItem('adminAuth');
        window.location.href = 'admin-login.html';
        return false;
    }
}

// Initialize dashboard
function initializeDashboard() {
    console.log('📊 Initializing Admin Dashboard...');
    
    // Setup logout button
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
    
    // Setup filter buttons
    document.getElementById('applyFilterBtn').addEventListener('click', applyFilters);
    document.getElementById('resetFilterBtn').addEventListener('click', resetFilters);
    document.getElementById('exportExcelBtn').addEventListener('click', exportToExcel);
    
    // Setup search
    document.getElementById('searchInput').addEventListener('input', handleSearch);
    
    // Load outpass data
    loadOutpassData();
}

// Handle logout
function handleLogout() {
    sessionStorage.removeItem('adminAuth');
    showSuccessMessage('✅ Logged out successfully');
    
    setTimeout(() => {
        window.location.href = 'admin-login.html';
    }, 1000);
}

// Show success message
function showSuccessMessage(message) {
    const successDiv = document.getElementById('successMessage');
    successDiv.textContent = message;
    successDiv.style.display = 'block';
    
    setTimeout(() => {
        successDiv.style.display = 'none';
    }, 3000);
}

// Load outpass data from Firebase
async function loadOutpassData() {
    const loadingDiv = document.getElementById('loadingDiv');
    const tableBody = document.getElementById('tableBody');
    
    loadingDiv.style.display = 'block';
    
    try {
        // Get all outpasses from Firestore
        const outpassesRef = db.collection('outpasses');
        const snapshot = await outpassesRef.orderBy('timestamp', 'desc').get();
        
        if (snapshot.empty) {
            tableBody.innerHTML = '<tr><td colspan="12" class="no-data">No outpass records found</td></tr>';
            updateStats(0, 0, 0, 0);
        } else {
            const outpasses = [];
            snapshot.forEach(doc => {
                outpasses.push({ id: doc.id, ...doc.data() });
            });
            
            // Store data globally for filtering
            window.allOutpasses = outpasses;
            
            // Display data
            displayOutpasses(outpasses);
            
            // Update statistics
            calculateStats(outpasses);
        }
        
    } catch (error) {
        console.error('Error loading data:', error);
        tableBody.innerHTML = '<tr><td colspan="12" class="no-data">Error loading data. Please refresh the page.</td></tr>';
    } finally {
        loadingDiv.style.display = 'none';
    }
}

// Display outpasses in table
function displayOutpasses(outpasses) {
    const tableBody = document.getElementById('tableBody');
    
    if (outpasses.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="12" class="no-data">No records match your filter</td></tr>';
        return;
    }
    
    tableBody.innerHTML = outpasses.map(outpass => {
        const date = outpass.timestamp ? new Date(outpass.timestamp).toLocaleString('en-IN') : 'N/A';
        
        return `
            <tr>
                <td><strong>${outpass.passNumber || 'N/A'}</strong></td>
                <td>${date}</td>
                <td>${outpass.studentId || 'N/A'}</td>
                <td><strong>${outpass.studentName || 'N/A'}</strong></td>
                <td>${outpass.category || 'N/A'}</td>
                <td>${outpass.section || 'N/A'}</td>
                <td>${outpass.fatherName || 'N/A'}</td>
                <td>${outpass.whatsapp || 'N/A'}</td>
                <td>${outpass.requestedBy || 'N/A'}</td>
                <td>${outpass.issuedBy || 'N/A'}</td>
                <td>${outpass.reason || 'N/A'}</td>
                <td><span class="status-badge status-active">Active</span></td>
            </tr>
        `;
    }).join('');
}

// Calculate statistics
function calculateStats(outpasses) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    const todayCount = outpasses.filter(o => {
        const date = new Date(o.timestamp);
        return date >= today;
    }).length;
    
    const weekCount = outpasses.filter(o => {
        const date = new Date(o.timestamp);
        return date >= weekAgo;
    }).length;
    
    const monthCount = outpasses.filter(o => {
        const date = new Date(o.timestamp);
        return date >= monthAgo;
    }).length;
    
    updateStats(outpasses.length, todayCount, weekCount, monthCount);
}

// Update statistics display
function updateStats(total, today, week, month) {
    document.getElementById('totalOutpasses').textContent = total;
    document.getElementById('todayOutpasses').textContent = today;
    document.getElementById('weeklyOutpasses').textContent = week;
    document.getElementById('monthlyOutpasses').textContent = month;
}

// Apply filters
function applyFilters() {
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    const category = document.getElementById('filterCategory').value;
    const issuedBy = document.getElementById('filterIssuedBy').value;
    
    let filtered = [...window.allOutpasses];
    
    // Filter by date range
    if (startDate) {
        const start = new Date(startDate);
        filtered = filtered.filter(o => new Date(o.timestamp) >= start);
    }
    
    if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59);
        filtered = filtered.filter(o => new Date(o.timestamp) <= end);
    }
    
    // Filter by category
    if (category) {
        filtered = filtered.filter(o => o.category === category);
    }
    
    // Filter by issued by
    if (issuedBy) {
        filtered = filtered.filter(o => o.issuedBy === issuedBy);
    }
    
    displayOutpasses(filtered);
    calculateStats(filtered);
    showSuccessMessage('✅ Filter applied successfully');
}

// Reset filters
function resetFilters() {
    document.getElementById('startDate').value = '';
    document.getElementById('endDate').value = '';
    document.getElementById('filterCategory').value = '';
    document.getElementById('filterIssuedBy').value = '';
    document.getElementById('searchInput').value = '';
    
    displayOutpasses(window.allOutpasses);
    calculateStats(window.allOutpasses);
    showSuccessMessage('✅ Filters reset');
}

// Handle search
function handleSearch(e) {
    const searchTerm = e.target.value.toLowerCase();
    
    const filtered = window.allOutpasses.filter(outpass => {
        return (
            (outpass.studentName && outpass.studentName.toLowerCase().includes(searchTerm)) ||
            (outpass.studentId && outpass.studentId.toLowerCase().includes(searchTerm)) ||
            (outpass.passNumber && outpass.passNumber.toLowerCase().includes(searchTerm)) ||
            (outpass.whatsapp && outpass.whatsapp.includes(searchTerm))
        );
    });
    
    displayOutpasses(filtered);
}

// Export to Excel
function exportToExcel() {
    try {
        const data = window.allOutpasses.map(outpass => ({
            'Pass Number': outpass.passNumber,
            'Date & Time': new Date(outpass.timestamp).toLocaleString('en-IN'),
            'Student ID': outpass.studentId,
            'Student Name': outpass.studentName,
            'Category': outpass.category,
            'Section': outpass.section,
            'Father Name': outpass.fatherName,
            'WhatsApp': outpass.whatsapp,
            'Requested By': outpass.requestedBy,
            'Issued By': outpass.issuedBy,
            'Reason': outpass.reason,
            'Status': 'Active'
        }));
        
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(data);
        
        // Set column widths
        ws['!cols'] = [
            { wch: 12 }, { wch: 20 }, { wch: 12 }, { wch: 20 },
            { wch: 10 }, { wch: 10 }, { wch: 20 }, { wch: 15 },
            { wch: 15 }, { wch: 15 }, { wch: 30 }, { wch: 10 }
        ];
        
        XLSX.utils.book_append_sheet(wb, ws, 'Outpasses');
        
        const filename = `Outpass_Records_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(wb, filename);
        
        showSuccessMessage('✅ Excel file downloaded successfully');
        
    } catch (error) {
        console.error('Export error:', error);
        alert('Error exporting data: ' + error.message);
    }
}

console.log('✅ Admin Dashboard Script Loaded');