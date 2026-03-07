// Show loading screen
document.body.style.display = 'none';

// Check authentication
auth.onAuthStateChanged((user) => {
    if (!user) {
        console.log('No user logged in, redirecting to login...');
        window.location.href = 'login.html';
        return;
    }
    
    console.log('Admin logged in:', user.email);
    document.getElementById('userEmail').textContent = user.email;
    
    if (document.body.style.display === 'none') {
        document.body.style.display = 'block';
    }
    
    // Load initial data
    loadStatistics();
    loadOutpasses();
});

// Logout functionality
document.getElementById('logoutBtn').addEventListener('click', async () => {
    try {
        await auth.signOut();
        window.location.href = 'login.html';
    } catch (error) {
        console.error('Logout error:', error);
    }
});

// Global variables
let allOutpasses = [];
let filteredOutpasses = [];

// Load statistics
async function loadStatistics() {
    try {
        const snapshot = await db.collection('outpasses').get();
        const outpasses = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        // Total outpasses
        document.getElementById('totalOutpasses').textContent = outpasses.length;
        
        // Today's outpasses
        const today = new Date().toLocaleDateString('en-IN');
        const todayCount = outpasses.filter(o => o.issuedDate === today).length;
        document.getElementById('todayOutpasses').textContent = todayCount;
        
        // This week's outpasses
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const weekCount = outpasses.filter(o => {
            if (!o.createdAt) return false;
            const date = o.createdAt.toDate ? o.createdAt.toDate() : new Date(o.createdAt);
            return date >= weekAgo;
        }).length;
        document.getElementById('weeklyOutpasses').textContent = weekCount;
        
        // This month's outpasses
        const monthAgo = new Date();
        monthAgo.setDate(monthAgo.getDate() - 30);
        const monthCount = outpasses.filter(o => {
            if (!o.createdAt) return false;
            const date = o.createdAt.toDate ? o.createdAt.toDate() : new Date(o.createdAt);
            return date >= monthAgo;
        }).length;
        document.getElementById('monthlyOutpasses').textContent = monthCount;
        
    } catch (error) {
        console.error('Error loading statistics:', error);
    }
}

// Load all outpasses
async function loadOutpasses() {
    try {
        document.getElementById('loadingDiv').style.display = 'block';
        document.getElementById('tableContainer').style.display = 'none';
        
        const snapshot = await db.collection('outpasses')
            .orderBy('createdAt', 'desc')
            .get();
        
        allOutpasses = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        filteredOutpasses = [...allOutpasses];
        displayOutpasses(filteredOutpasses);
        
        document.getElementById('loadingDiv').style.display = 'none';
        document.getElementById('tableContainer').style.display = 'block';
        
    } catch (error) {
        console.error('Error loading outpasses:', error);
        document.getElementById('loadingDiv').style.display = 'none';
        document.getElementById('tableBody').innerHTML = 
            '<tr><td colspan="12" class="no-data">Error loading data</td></tr>';
    }
}

// Display outpasses in table
function displayOutpasses(outpasses) {
    const tbody = document.getElementById('tableBody');
    
    if (outpasses.length === 0) {
        tbody.innerHTML = '<tr><td colspan="12" class="no-data">No outpasses found</td></tr>';
        return;
    }
    
    tbody.innerHTML = outpasses.map(outpass => `
        <tr>
            <td><strong>${outpass.passNumber || 'N/A'}</strong></td>
            <td>${outpass.issuedDate || 'N/A'}<br><small>${outpass.issuedTime || ''}</small></td>
            <td>${outpass.studentId || 'N/A'}</td>
            <td><strong>${outpass.studentName || 'N/A'}</strong></td>
            <td>${outpass.category || 'N/A'}</td>
            <td>${outpass.section || 'N/A'}</td>
            <td>${outpass.fatherName || 'N/A'}</td>
            <td>${outpass.whatsappNumber || 'N/A'}</td>
            <td>${outpass.requestedBy || 'N/A'}</td>
            <td>${outpass.issuedBy || 'N/A'}</td>
            <td><small>${(outpass.reason || 'N/A').substring(0, 50)}${outpass.reason && outpass.reason.length > 50 ? '...' : ''}</small></td>
            <td><span class="status-badge status-active">${outpass.status || 'Active'}</span></td>
        </tr>
    `).join('');
}

// Search functionality
document.getElementById('searchInput').addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase().trim();
    
    if (searchTerm === '') {
        displayOutpasses(filteredOutpasses);
        return;
    }
    
    const searchResults = filteredOutpasses.filter(outpass => {
        return (
            (outpass.studentName || '').toLowerCase().includes(searchTerm) ||
            (outpass.studentId || '').toLowerCase().includes(searchTerm) ||
            (outpass.passNumber || '').toLowerCase().includes(searchTerm) ||
            (outpass.fatherName || '').toLowerCase().includes(searchTerm) ||
            (outpass.whatsappNumber || '').includes(searchTerm)
        );
    });
    
    displayOutpasses(searchResults);
});

// Apply filters
document.getElementById('applyFilterBtn').addEventListener('click', () => {
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    const category = document.getElementById('filterCategory').value;
    const issuedBy = document.getElementById('filterIssuedBy').value;
    
    filteredOutpasses = allOutpasses.filter(outpass => {
        let matches = true;
        
        // Date filter
        if (startDate && endDate) {
            const outpassDate = parseIndianDate(outpass.issuedDate);
            const start = new Date(startDate);
            const end = new Date(endDate);
            
            if (outpassDate < start || outpassDate > end) {
                matches = false;
            }
        }
        
        // Category filter
        if (category && outpass.category !== category) {
            matches = false;
        }
        
        // Issued by filter
        if (issuedBy && outpass.issuedBy !== issuedBy) {
            matches = false;
        }
        
        return matches;
    });
    
    displayOutpasses(filteredOutpasses);
    showMessage(`Filtered: ${filteredOutpasses.length} records found`);
});

// Reset filters
document.getElementById('resetFilterBtn').addEventListener('click', () => {
    document.getElementById('startDate').value = '';
    document.getElementById('endDate').value = '';
    document.getElementById('filterCategory').value = '';
    document.getElementById('filterIssuedBy').value = '';
    document.getElementById('searchInput').value = '';
    
    filteredOutpasses = [...allOutpasses];
    displayOutpasses(filteredOutpasses);
    showMessage('Filters reset');
});

// Export to Excel
document.getElementById('exportExcelBtn').addEventListener('click', () => {
    try {
        if (filteredOutpasses.length === 0) {
            alert('No data to export');
            return;
        }
        
        // Prepare data for Excel
        const excelData = filteredOutpasses.map(outpass => ({
            'Pass Number': outpass.passNumber || '',
            'Date': outpass.issuedDate || '',
            'Time': outpass.issuedTime || '',
            'Student ID': outpass.studentId || '',
            'Student Name': outpass.studentName || '',
            'Category': outpass.category || '',
            'Section': outpass.section || '',
            'Father Name': outpass.fatherName || '',
            'WhatsApp Number': outpass.whatsappNumber || '',
            'Requested By': outpass.requestedBy || '',
            'Issued By': outpass.issuedBy || '',
            'Reason': outpass.reason || '',
            'Status': outpass.status || 'Active',
            'Created By': outpass.createdBy || ''
        }));
        
        // Create workbook and worksheet
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(excelData);
        
        // Set column widths
        const wscols = [
            {wch: 15}, // Pass Number
            {wch: 12}, // Date
            {wch: 12}, // Time
            {wch: 15}, // Student ID
            {wch: 20}, // Student Name
            {wch: 10}, // Category
            {wch: 10}, // Section
            {wch: 20}, // Father Name
            {wch: 15}, // WhatsApp
            {wch: 12}, // Requested By
            {wch: 15}, // Issued By
            {wch: 40}, // Reason
            {wch: 10}, // Status
            {wch: 25}  // Created By
        ];
        ws['!cols'] = wscols;
        
        // Add worksheet to workbook
        XLSX.utils.book_append_sheet(wb, ws, 'Outpasses');
        
        // Generate filename with date
        const date = new Date().toLocaleDateString('en-IN').replace(/\//g, '-');
        const filename = `Outpass_Records_${date}.xlsx`;
        
        // Save file
        XLSX.writeFile(wb, filename);
        
        showMessage(`✅ Excel file downloaded: ${filename}`);
        
    } catch (error) {
        console.error('Error exporting to Excel:', error);
        alert('Error exporting to Excel. Please try again.');
    }
});

// Helper function to parse Indian date format (DD/MM/YYYY)
function parseIndianDate(dateStr) {
    if (!dateStr) return new Date();
    const parts = dateStr.split('/');
    if (parts.length !== 3) return new Date();
    return new Date(parts[2], parts[1] - 1, parts[0]);
}

// Show success message
function showMessage(message) {
    const msgDiv = document.getElementById('successMessage');
    msgDiv.textContent = message;
    msgDiv.style.display = 'block';
    
    setTimeout(() => {
        msgDiv.style.display = 'none';
    }, 3000);
}
