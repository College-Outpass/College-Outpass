// Show loading screen
document.body.style.display = 'none';

// Sequential outpass number counter
let studentPhotoData = null;

// Function to generate sequential outpass number from Firestore
async function generateOutpassNumber() {
    try {
        const counterRef = db.collection('settings').doc('outpassCounter');
        
        // Use Firestore transaction to safely increment counter
        const newNumber = await db.runTransaction(async (transaction) => {
            const counterDoc = await transaction.get(counterRef);
            
            let currentCount = 1;
            if (counterDoc.exists) {
                currentCount = counterDoc.data().count || 1;
            }
            
            const nextCount = currentCount + 1;
            
            // Update counter in Firestore
            transaction.set(counterRef, { count: nextCount });
            
            return currentCount;
        });
        
        const paddedNumber = newNumber.toString().padStart(4, '0');
        return `OUTPASS-${paddedNumber}`;
        
    } catch (error) {
        console.error('Error generating outpass number:', error);
        // Fallback to timestamp-based number if Firestore fails
        const timestamp = Date.now().toString().slice(-4);
        return `OUTPASS-${timestamp}`;
    }
}

// Function to generate sequential sick slip number from Firestore
async function generateSickSlipNumber() {
    try {
        const counterRef = db.collection('settings').doc('sickSlipCounter');
        
        const newNumber = await db.runTransaction(async (transaction) => {
            const counterDoc = await transaction.get(counterRef);
            
            let currentCount = 1;
            if (counterDoc.exists) {
                currentCount = counterDoc.data().count || 1;
            }
            
            const nextCount = currentCount + 1;
            transaction.set(counterRef, { count: nextCount });
            
            return currentCount;
        });
        
        const paddedNumber = newNumber.toString().padStart(4, '0');
        return `MEDSLIP-${paddedNumber}`;
        
    } catch (error) {
        console.error('Error generating sick slip number:', error);
        const timestamp = Date.now().toString().slice(-4);
        return `MEDSLIP-${timestamp}`;
    }
}

// Check authentication - FIXED: Only redirect if NOT logged in
auth.onAuthStateChanged((user) => {
    if (!user) {
        // Not logged in, redirect to staff login immediately
        console.log('No user logged in, redirecting to staff login...');
        window.location.href = 'staff-login.html';
        return;
    }
    
    // User is logged in, show dashboard content
    console.log('User logged in:', user.email);
    document.getElementById('userEmail').textContent = user.email;
    
    // Show content - only once on page load
    if (document.body.style.display === 'none') {
        document.body.style.display = 'block';
    }
    
    // Set default dates
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    document.getElementById('outDate').valueAsDate = today;
    document.getElementById('inDate').valueAsDate = tomorrow;
    document.getElementById('sickDate').valueAsDate = today;
    
    // Set default time to current time
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    document.getElementById('sickTime').value = `${hours}:${minutes}`;
});

// Logout functionality
document.getElementById('logoutBtn').addEventListener('click', async () => {
    try {
        await auth.signOut();
        console.log('User logged out');
        window.location.href = 'staff-login.html';
    } catch (error) {
        console.error('Logout error:', error);
        alert('Error logging out. Please try again.');
    }
});

// Dashboard selection functionality
document.getElementById('outpassOption').addEventListener('click', function() {
    document.getElementById('outpassFormContainer').style.display = 'block';
    document.getElementById('sickSlipFormContainer').style.display = 'none';
    document.getElementById('outpassOption').classList.add('active');
    document.getElementById('sickSlipOption').classList.remove('active');
    hideMessages();
});

document.getElementById('sickSlipOption').addEventListener('click', function() {
    document.getElementById('outpassFormContainer').style.display = 'none';
    document.getElementById('sickSlipFormContainer').style.display = 'block';
    document.getElementById('sickSlipOption').classList.add('active');
    document.getElementById('outpassOption').classList.remove('active');
    hideMessages();
});

// Get form elements
const form = document.getElementById('outpassForm');
const generateBtn = document.getElementById('generateBtn');
const generateText = document.getElementById('generateText');
const generateLoader = document.getElementById('generateLoader');
const successMessage = document.getElementById('successMessage');
const errorMessage = document.getElementById('errorMessage');
const studentPhotoInput = document.getElementById('studentPhoto');
const photoPreview = document.getElementById('photoPreview');
const previewImage = document.getElementById('previewImage');
const deletePhotoBtn = document.getElementById('deletePhotoBtn');
const clearFormBtn = document.getElementById('clearFormBtn');

// Sick slip form elements
const sickSlipForm = document.getElementById('sickSlipForm');
const generateSickSlipBtn = document.getElementById('generateSickSlipBtn');
const generateSickSlipText = document.getElementById('generateSickSlipText');
const generateSickSlipLoader = document.getElementById('generateSickSlipLoader');
const sickSlipSuccessMessage = document.getElementById('sickSlipSuccessMessage');
const sickSlipErrorMessage = document.getElementById('sickSlipErrorMessage');
const clearSickSlipFormBtn = document.getElementById('clearSickSlipFormBtn');

// Clear form functionality
clearFormBtn.addEventListener('click', function() {
    // Clear all form fields
    form.reset();
    
    // Clear photo
    studentPhotoData = null;
    photoPreview.style.display = 'none';
    previewImage.src = '';
    deletePhotoBtn.style.display = 'none';
    
    // Hide messages
    hideMessages();
    
    // Show confirmation
    showSuccess('✅ Form cleared! Ready to enter new student details.');
    setTimeout(() => hideMessages(), 2000);
    
    // Reset dates to default
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    document.getElementById('outDate').valueAsDate = today;
    document.getElementById('inDate').valueAsDate = tomorrow;
    
    // Focus on first field
    document.getElementById('studentId').focus();
});

// Clear sick slip form functionality
clearSickSlipFormBtn.addEventListener('click', function() {
    sickSlipForm.reset();
    hideMessages();
    showSickSlipSuccess('✅ Form cleared! Ready to enter new sick slip details.');
    setTimeout(() => hideMessages(), 2000);
    
    // Reset dates to default
    const today = new Date();
    document.getElementById('sickDate').valueAsDate = today;
    
    // Set default time to current time
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    document.getElementById('sickTime').value = `${hours}:${minutes}`;
    
    document.getElementById('sickStudentId').focus();
});

// Student photo upload functionality - NO CROPPING, use original photo
studentPhotoInput.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        // Validate file type
        if (!file.type.startsWith('image/')) {
            showError('Please select a valid image file');
            return;
        }

        // Validate file size (max 5MB - increased for better quality)
        if (file.size > 5 * 1024 * 1024) {
            showError('Image size should be less than 5MB');
            return;
        }

        const reader = new FileReader();
        reader.onload = function(e) {
            // Store original photo without any modification
            studentPhotoData = e.target.result;
            previewImage.src = studentPhotoData;
            photoPreview.style.display = 'block';
            deletePhotoBtn.style.display = 'inline-block';
            
            // Show success message
            showSuccess('✅ Photo uploaded successfully!');
            setTimeout(() => hideMessages(), 2000);
        };
        reader.readAsDataURL(file);
    }
});

// Delete photo functionality
deletePhotoBtn.addEventListener('click', function() {
    // Clear photo data
    studentPhotoData = null;
    
    // Clear file input
    studentPhotoInput.value = '';
    
    // Hide preview
    photoPreview.style.display = 'none';
    previewImage.src = '';
    
    // Hide delete button
    deletePhotoBtn.style.display = 'none';
    
    // Show success message
    showSuccess('📸 Photo removed successfully! You can upload a new one.');
    
    // Hide message after 2 seconds
    setTimeout(() => {
        hideMessages();
    }, 2000);
});

// Form submission - UPDATED WITH 15 SECOND DELAY AND FIXED PDF DOWNLOAD
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
        return;
    }
    
    // Show loader
    generateText.style.display = 'none';
    generateLoader.style.display = 'inline-block';
    generateBtn.disabled = true;
    hideMessages();
    
    try {
        // Get current user
        const user = auth.currentUser;
        if (!user) {
            throw new Error('User not authenticated');
        }
        
        // Generate outpass data with auto-incrementing number
        const passNumber = await generateOutpassNumber();
        
        const outpassData = {
            studentId: document.getElementById('studentId').value.trim(),
            studentName: document.getElementById('studentName').value.trim(),
            category: document.getElementById('category').value,
            section: document.getElementById('section').value.trim(),
            fatherName: document.getElementById('fatherName').value.trim(),
            whatsappNumber: document.getElementById('whatsappNumber').value.trim(),
            requestedBy: document.getElementById('requestedBy').value,
            issuedBy: document.getElementById('issuedBy').value,
            status: document.getElementById('status').value,
            outDate: document.getElementById('outDate').value,
            inDate: document.getElementById('inDate').value,
            reason: document.getElementById('reason').value.trim(),
            passNumber: passNumber,
            issuedDate: new Date().toLocaleDateString('en-IN'),
            issuedTime: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }),
            studentPhoto: studentPhotoData,
            createdBy: user.email,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        // Save to Firestore
        await db.collection('outpasses').add(outpassData);
        
        // STEP 1: Generate and download PDF first - wait for completion
        console.log('Starting PDF generation...');
        await generatePDF(outpassData);
        console.log('PDF download initiated');
        
        // STEP 2: Show success message and inform about WhatsApp with countdown
        let countdown = 15;
        showSuccess(`✅ PDF Downloaded Successfully! Opening WhatsApp in ${countdown} seconds...`);
        
        // Update countdown every second
        const countdownInterval = setInterval(() => {
            countdown--;
            if (countdown > 0) {
                showSuccess(`✅ PDF Downloaded Successfully! Opening WhatsApp in ${countdown} seconds...`);
            } else {
                clearInterval(countdownInterval);
            }
        }, 1000);
        
        // STEP 3: Wait 15 seconds to ensure PDF download completes, then open WhatsApp
        setTimeout(() => {
            console.log('Opening WhatsApp...');
            sendWhatsAppMessage(outpassData);
            
            // Show final message with option to continue
            showSuccess('✅ PDF Downloaded & WhatsApp Opened! You can now enter another student details.');
            
            // Re-enable button for next entry
            generateText.style.display = 'inline';
            generateLoader.style.display = 'none';
            generateBtn.disabled = false;
        }, 15000);
        
    } catch (error) {
        console.error('Error generating outpass:', error);
        showError('Failed to generate outpass: ' + error.message);
        
        // Re-enable button on error
        generateText.style.display = 'inline';
        generateLoader.style.display = 'none';
        generateBtn.disabled = false;
    }
});

// Sick slip form submission
sickSlipForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!validateSickSlipForm()) {
        return;
    }
    
    // Show loader
    generateSickSlipText.style.display = 'none';
    generateSickSlipLoader.style.display = 'inline-block';
    generateSickSlipBtn.disabled = true;
    hideMessages();
    
    try {
        const user = auth.currentUser;
        if (!user) {
            throw new Error('User not authenticated');
        }
        
        const sickSlipNumber = await generateSickSlipNumber();
        
        const sickSlipData = {
            studentId: document.getElementById('sickStudentId').value.trim(),
            studentName: document.getElementById('sickStudentName').value.trim(),
            date: document.getElementById('sickDate').value,
            time: document.getElementById('sickTime').value,
            reason: document.getElementById('sickReason').value.trim(),
            status: document.getElementById('sickStatus').value,
            issuedBy: document.getElementById('sickIssuedBy').value,
            sickSlipNumber: sickSlipNumber,
            issuedDate: new Date().toLocaleDateString('en-IN'),
            issuedTime: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }),
            createdBy: user.email,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        // Save to Firestore
        await db.collection('sickSlips').add(sickSlipData);
        
        // Generate and download PDF
        console.log('Starting Sick Slip PDF generation...');
        showSickSlipSuccess('⏳ Generating Sick Slip PDF... Please wait...');
        
        await generateSickSlipPDF(sickSlipData);
        
        showSickSlipSuccess('✅ Complete! Sick Slip PDF downloaded. Ready for next student.');
        
        // Re-enable button
        generateSickSlipText.style.display = 'inline';
        generateSickSlipLoader.style.display = 'none';
        generateSickSlipBtn.disabled = false;
        
    } catch (error) {
        console.error('Error generating sick slip:', error);
        showSickSlipError('Failed to generate sick slip: ' + error.message);
        
        generateSickSlipText.style.display = 'inline';
        generateSickSlipLoader.style.display = 'none';
        generateSickSlipBtn.disabled = false;
    }
});

// Form validation
function validateForm() {
    const fields = [
        'studentId', 'studentName', 'category', 'section', 
        'fatherName', 'whatsappNumber', 'requestedBy', 'issuedBy', 
        'status', 'outDate', 'inDate', 'reason'
    ];
    
    for (let field of fields) {
        const element = document.getElementById(field);
        if (!element.value.trim()) {
            const label = element.previousElementSibling;
            showError(`Please fill in ${label ? label.textContent : field}`);
            element.focus();
            return false;
        }
    }
    
    // Validate dates
    const outDate = new Date(document.getElementById('outDate').value);
    const inDate = new Date(document.getElementById('inDate').value);
    
    if (inDate <= outDate) {
        showError('In Date must be after Out Date');
        document.getElementById('inDate').focus();
        return false;
    }
    
    // Validate WhatsApp number
    const whatsappNumber = document.getElementById('whatsappNumber').value.trim();
    const cleanNumber = whatsappNumber.replace(/\D/g, '');
    
    if (cleanNumber.length < 10) {
        showError('Please enter a valid 10-digit WhatsApp number');
        document.getElementById('whatsappNumber').focus();
        return false;
    }
    
    return true;
}

// Sick slip form validation
function validateSickSlipForm() {
    const fields = [
        'sickStudentId', 'sickStudentName', 'sickDate', 'sickTime', 
        'sickReason', 'sickStatus', 'sickIssuedBy'
    ];
    
    for (let field of fields) {
        const element = document.getElementById(field);
        if (!element.value.trim()) {
            const label = element.previousElementSibling;
            showSickSlipError(`Please fill in ${label ? label.textContent : field}`);
            element.focus();
            return false;
        }
    }
    
    return true;
}

// Helper function to format dates for PDF
function formatDateForPDF(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

// Helper function to format time for PDF
function formatTimeForPDF(timeString) {
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
}

// ==================== FIXED PDF GENERATION WITH BLOB DOWNLOAD METHOD ====================

function generatePDF(outpassData) {
    return new Promise((resolve, reject) => {
        try {
            console.log('Updating PDF template with data...');
            
            // Update PDF template with data
            document.getElementById('pdfPassNumber').textContent = outpassData.passNumber;
            document.getElementById('pdfDate').textContent = outpassData.issuedDate;
            document.getElementById('pdfTime').textContent = outpassData.issuedTime;
            document.getElementById('pdfStudentId').textContent = outpassData.studentId;
            document.getElementById('pdfStudentName').textContent = outpassData.studentName;
            document.getElementById('pdfCategory').textContent = outpassData.category;
            document.getElementById('pdfSection').textContent = outpassData.section;
            document.getElementById('pdfFatherName').textContent = outpassData.fatherName;
            document.getElementById('pdfWhatsApp').textContent = outpassData.whatsappNumber;
            document.getElementById('pdfRequestedBy').textContent = outpassData.requestedBy;
            document.getElementById('pdfReason').textContent = outpassData.reason;
            document.getElementById('pdfIssuingAuthority').textContent = outpassData.issuedBy;
            
            // NEW FIELDS FOR PDF
            document.getElementById('pdfStatus').textContent = outpassData.status;
            document.getElementById('pdfOutDate').textContent = formatDateForPDF(outpassData.outDate);
            document.getElementById('pdfInDate').textContent = formatDateForPDF(outpassData.inDate);
            
            // Apply status-specific styling
            const statusElement = document.getElementById('pdfStatus');
            statusElement.className = ''; // Clear previous classes
            statusElement.classList.add(`status-${outpassData.status.toLowerCase()}`);

            // Update student photo in PDF
            const pdfStudentPhotoImg = document.getElementById('pdfStudentPhotoImg');
            if (outpassData.studentPhoto) {
                pdfStudentPhotoImg.src = outpassData.studentPhoto;
                document.getElementById('pdfStudentPhoto').style.display = 'block';
            } else {
                document.getElementById('pdfStudentPhoto').style.display = 'none';
            }

            // Show the template temporarily for rendering
            const pdfTemplate = document.getElementById('pdfTemplate');
            pdfTemplate.style.display = 'block';
            pdfTemplate.style.position = 'absolute';
            pdfTemplate.style.left = '0';
            pdfTemplate.style.top = '0';
            pdfTemplate.style.zIndex = '-1';

            console.log('Capturing template with html2canvas...');

            // Use html2canvas to capture the template
            html2canvas(pdfTemplate, {
                scale: 2,
                useCORS: true,
                allowTaint: true,
                logging: false,
                backgroundColor: '#ffffff',
                width: 794,
                height: 1123,
                scrollX: 0,
                scrollY: 0,
                windowWidth: 794,
                windowHeight: 1123
            }).then(canvas => {
                console.log('Canvas captured, creating PDF...');
                
                // Hide template
                pdfTemplate.style.display = 'none';

                // Create PDF
                const { jsPDF } = window.jspdf;
                const pdf = new jsPDF({
                    orientation: 'portrait',
                    unit: 'mm',
                    format: 'a4'
                });
                
                // Convert canvas to image
                const imgData = canvas.toDataURL('image/png', 1.0);
                
                // A4 dimensions in mm
                const pdfWidth = 210;
                const pdfHeight = 297;
                
                // Calculate image dimensions to fit A4
                const imgWidth = pdfWidth;
                const imgHeight = (canvas.height * pdfWidth) / canvas.width;
                
                // Add image to PDF
                pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight, '', 'FAST');
                
                // Generate filename
                const filename = `Outpass_${outpassData.studentName}_${outpassData.passNumber}.pdf`;
                
                console.log('Saving PDF:', filename);
                
                // FIXED: Use blob method for better download compatibility
                const pdfBlob = pdf.output('blob');
                const url = URL.createObjectURL(pdfBlob);
                
                // Create download link
                const downloadLink = document.createElement('a');
                downloadLink.href = url;
                downloadLink.download = filename;
                downloadLink.style.display = 'none';
                document.body.appendChild(downloadLink);
                
                // Trigger download
                downloadLink.click();
                
                // Cleanup
                setTimeout(() => {
                    document.body.removeChild(downloadLink);
                    URL.revokeObjectURL(url);
                }, 100);
                
                console.log('PDF download triggered successfully');
                
                // Wait to ensure download starts
                setTimeout(() => {
                    resolve();
                }, 1000);
                
            }).catch(error => {
                console.error('html2canvas error:', error);
                pdfTemplate.style.display = 'none';
                reject(new Error('Failed to generate PDF: ' + error.message));
            });
            
        } catch (error) {
            console.error('Error in generatePDF:', error);
            reject(new Error('PDF generation failed: ' + error.message));
        }
    });
}

// PDF GENERATION for Sick Slip - UPDATED FOR COMPACT FORMAT
function generateSickSlipPDF(sickSlipData) {
    return new Promise((resolve, reject) => {
        try {
            console.log('Updating Sick Slip PDF template with data...');
            
            document.getElementById('sickSlipNumber').textContent = sickSlipData.sickSlipNumber;
            document.getElementById('sickSlipStudentId').textContent = sickSlipData.studentId;
            document.getElementById('sickSlipStudentName').textContent = sickSlipData.studentName;
            document.getElementById('sickSlipDate').textContent = formatDateForPDF(sickSlipData.date);
            document.getElementById('sickSlipTime').textContent = formatTimeForPDF(sickSlipData.time);
            document.getElementById('sickSlipReason').textContent = sickSlipData.reason;
            document.getElementById('sickSlipStatus').textContent = sickSlipData.status;
            document.getElementById('sickSlipIssuedBy').textContent = sickSlipData.issuedBy;
            
            // Apply status-specific styling
            const statusElement = document.getElementById('sickSlipStatus');
            statusElement.className = 'sick-slip-status-box'; // Reset classes
            if (sickSlipData.status === 'APPROVED') {
                statusElement.classList.add('status-approved');
            } else {
                statusElement.classList.add('status-rejected');
            }

            const pdfTemplate = document.getElementById('sickSlipPdfTemplate');
            pdfTemplate.style.display = 'block';
            pdfTemplate.style.position = 'absolute';
            pdfTemplate.style.left = '0';
            pdfTemplate.style.top = '0';
            pdfTemplate.style.zIndex = '-1';

            console.log('Capturing sick slip template with html2canvas...');

            html2canvas(pdfTemplate, {
                scale: 2,
                useCORS: true,
                allowTaint: true,
                logging: false,
                backgroundColor: '#ffffff',
                width: 794,
                height: 450, // Compact height for slip format
                scrollX: 0,
                scrollY: 0,
                windowWidth: 794,
                windowHeight: 450
            }).then(canvas => {
                console.log('Sick slip canvas captured, creating PDF...');
                
                pdfTemplate.style.display = 'none';

                const { jsPDF } = window.jspdf;
                const pdf = new jsPDF({
                    orientation: 'portrait',
                    unit: 'mm',
                    format: 'a4'
                });
                
                const imgData = canvas.toDataURL('image/png', 1.0);
                const pdfWidth = 210;
                const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
                
                pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight, '', 'FAST');
                
                const filename = `MedicalSlip_${sickSlipData.studentName}_${sickSlipData.sickSlipNumber}.pdf`;
                
                console.log('Saving Sick Slip PDF:', filename);
                
                const pdfBlob = pdf.output('blob');
                const url = URL.createObjectURL(pdfBlob);
                
                const downloadLink = document.createElement('a');
                downloadLink.href = url;
                downloadLink.download = filename;
                downloadLink.style.display = 'none';
                document.body.appendChild(downloadLink);
                
                downloadLink.click();
                
                setTimeout(() => {
                    document.body.removeChild(downloadLink);
                    URL.revokeObjectURL(url);
                }, 100);
                
                console.log('Sick Slip PDF download triggered successfully');
                
                setTimeout(() => {
                    resolve();
                }, 1000);
                
            }).catch(error => {
                console.error('html2canvas error for sick slip:', error);
                pdfTemplate.style.display = 'none';
                reject(new Error('Failed to generate sick slip PDF: ' + error.message));
            });
            
        } catch (error) {
            console.error('Error in generateSickSlipPDF:', error);
            reject(new Error('Sick slip PDF generation failed: ' + error.message));
        }
    });
}
// ==================== WHATSAPP MESSAGE FUNCTION ====================

function sendWhatsAppMessage(outpassData) {
    try {
        // Clean and format phone number
        let phone = outpassData.whatsappNumber.replace(/\D/g, '');
        
        // Add country code if not present
        if (phone.length === 10) {
            phone = '91' + phone; // Add India country code
        }
        
        console.log('Sending WhatsApp to:', phone);
        
        // Professional WhatsApp message template
        const message = `🎓 *SRI CHAITANYA EDUCATIONAL INSTITUTIONS*
Electronic City Campus - Hostel Outpass

━━━━━━━━━━━━━━━━━━━━━━

📋 *OUTPASS DETAILS*

🔢 Outpass No: *${outpassData.passNumber}*
📅 Date: *${outpassData.issuedDate}*
⏰ Time: *${outpassData.issuedTime}*
📊 Status: *${outpassData.status}*

━━━━━━━━━━━━━━━━━━━━━━

📅 *OUTPASS DATES*

➡️ Out Date: *${formatDateForPDF(outpassData.outDate)}*
⬅️ In Date: *${formatDateForPDF(outpassData.inDate)}*

━━━━━━━━━━━━━━━━━━━━━━

👨‍🎓 *STUDENT INFORMATION*

🆔 Student ID: *${outpassData.studentId}*
📝 Name: *${outpassData.studentName}*
📚 Category: *${outpassData.category}*
🏫 Section: *${outpassData.section}*

━━━━━━━━━━━━━━━━━━━━━━

👨‍👩‍👧 *PARENT INFORMATION*

👨 Father's Name: *${outpassData.fatherName}*
📱 Contact: *${outpassData.whatsappNumber}*
✍️ Requested By: *${outpassData.requestedBy}*

━━━━━━━━━━━━━━━━━━━━━━

📝 *REASON FOR OUTPASS*
${outpassData.reason}

━━━━━━━━━━━━━━━━━━━━━━

✅ *Issued By:* ${outpassData.issuedBy}

⚠️ *IMPORTANT INSTRUCTIONS:*
- Show this message at hostel gate
- Carry your ID card
- Printed PDF also provided
- Valid for today only
- Return as per hostel timings

🏫 *Sri Chaitanya Educational Institutions*
📍 Electronic City, Bangalore

For queries, contact hostel office.`;

        // Create WhatsApp URL - Using wa.me for better compatibility
        const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
        
        console.log('Opening WhatsApp in new tab...');
        
        // Check if mobile device
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        
        if (isMobile) {
            // For mobile, open directly in WhatsApp
            window.open(whatsappUrl, '_blank');
        } else {
            // For desktop, show message and copy to clipboard
            navigator.clipboard.writeText(message).then(() => {
                alert('WhatsApp message copied to clipboard. Please paste it in WhatsApp Web or your mobile WhatsApp.');
            }).catch(() => {
                alert('Please copy the following message and send it via WhatsApp:\n\n' + message);
            });
        }
        
    } catch (error) {
        console.error('Error opening WhatsApp:', error);
        showError('WhatsApp could not be opened. Please send message manually.');
    }
}

// Message functions
function showSuccess(message) {
    successMessage.textContent = message;
    successMessage.style.display = 'block';
    errorMessage.style.display = 'none';
}

function showError(message) {
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
    successMessage.style.display = 'none';
}

function showSickSlipSuccess(message) {
    sickSlipSuccessMessage.textContent = message;
    sickSlipSuccessMessage.style.display = 'block';
    sickSlipErrorMessage.style.display = 'none';
}

function showSickSlipError(message) {
    sickSlipErrorMessage.textContent = message;
    sickSlipErrorMessage.style.display = 'block';
    sickSlipSuccessMessage.style.display = 'none';
}

function hideMessages() {
    successMessage.style.display = 'none';
    errorMessage.style.display = 'none';
    sickSlipSuccessMessage.style.display = 'none';
    sickSlipErrorMessage.style.display = 'none';
}

// Auto-format phone number as user types
document.getElementById('whatsappNumber').addEventListener('input', function(e) {
    let value = e.target.value.replace(/\D/g, '');
    
    if (value.length > 10) {
        value = value.slice(0, 12);
    }
    
    e.target.value = value;
});