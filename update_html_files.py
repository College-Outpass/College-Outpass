import os
import re

html_dir = r"f:\Projects\college-outpass-system\public"
target_files = [
    "admin-dashboard.html",
    "admin-login.html",
    "dashboard.html",
    "staff-login.html",
    "staff-admin-dashboard.html",
    "add-security.html",
    "bulk-create-users.html"
]

search_pattern = r'(<script src="https://www\.gstatic\.com/firebasejs/9\.22\.0/firebase-firestore-compat\.js"></script>)'
replacement = r'\1\n    <script src="js/firebase-config.js"></script>'

for filename in target_files:
    filepath = os.path.join(html_dir, filename)
    if os.path.exists(filepath):
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            
        if 'js/firebase-config.js' not in content:
            new_content = re.sub(search_pattern, replacement, content)
            if new_content != content:
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(new_content)
                print(f"Updated {filename}")
            else:
                print(f"Pattern not found in {filename}")
        else:
            print(f"Already updated {filename}")
    else:
        print(f"File not found: {filename}")
