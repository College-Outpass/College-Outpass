const serviceAccountB64 = "ewogICJwcm9qZWN0X2lkIjogImNvbGxlZ2Utb3V0LXBhc3Mtc3lzdGVtLTYyNTUyIiwKICAicHJpdmF0ZV9rZXkiOiAiLS0tLS1CRUdJTiBQUklWQVRFIEtFWS0tLS0tXG5NSUlFdmdJQkFEQU5CZ2txaGtpRzl3MEJBUUVGQUFTQ0JLZ3dnZ1NrQWdFQUFvSUJBUURPTzhQWjBYZnBwc0pOXG5sZm1kT2hacHloZ1dkMjhxVkVhMGFiUXNBSnBGcUw3VHF2Q21ROWc2RzdnNHQ2cEFocTk4UEFkVjgwZHJzTFJ3XG4zdHo2QlJGaWhpRmlMVmY4eWhoV1l3cmlSeElGdC84NFkzMHlTd1M3M05mYnVFK25kalZNV204Qmt4bWd0bHFHXG40VkdpdE41bzdhYVd6NS9mTm9ZUVE5dTRGQkpZMitDV2pnVmdDTEphYldSOS94T1dlOVlVQ1N2U0U3TUF6eGJBXG5WVWxrSzEzK2xUNEhVNFBkZ2d2cTNTZmgrZU1VWDZrdHlWMW5kTVVGc2lHekEzbEV0RHU0YkpWU3hRZVE0eGlvXG5HN2tkTU1NbENURlFMbW12WFRiY3ZjSGdUWmRMN0hCbzY2c29DVTM4bXFuTkdWekRZd1owNjRjamxzdkZYa3NjXG44Z2RiR0ViYkFnTUJBQUVDZ2dFQUNlTEFoU0R1M0JManpuOUphMWw4K0k0NDhGN0NRK2V0U2ZtbEt0VE9rRmRCXG42bmlQdDVDWi9WTVYxaFlyd1pNVE4yUFRRREg4c3ZOUit2VWI1NW8xbHFEeVdiZnR0MDdpc3NWbG9Lb2llWWF6XG40N3FWSmtPRlV4SUhnTjlKWmpBYTV2R1F6NlVDL2ZxdnhUWm95T0ZkcGU3NlpORklDeFdjZ0l3WUxLODluK2U0XG5TUFZGSmFYYzNTMUlSTWRUOVAvR2NuN0RLeUQyeWludUk0K2FuUmZXaDdmdjFwanB2a2pGV3dMcko3eS9WMjdQXG43YmFRcjU3R0hEblNGdXg4NXVMYXJHTWRvTG8waUEzZkFWV0V2bU5FU1JBQ2hSeFZJcDZyWE1mRjV0ZTdVYUluXG5uNnAzYTNxeXhFbzArOGxOR3pOMXBCbTY5SjZRUk5QNmZzRHRJVHA1NFFLQmdRRG85Qm9lZnBZbHFabWxzMmhvXG4xNTBDcVRUTGlWUnZHQ1Jpc1FqakNzMEpLeHpockdYNThzSnFiMTFjdnBUQ3RFdEc3SUtJSysyaFcvSWpXZ1VTXG5XZk9vTFpYZ25Pd1BEOVltVEkrRGo2ZXNvR1c0K3poOUFGVG9UV04zQWJ6YW5rdjBwaTU5eVM1Rmo3eUMrcmgrXG42TXdQQStaL1NQVDJqYmJnNmZrNkEyZVpld0tCZ1FEaW91L3JzZnFZZ09ZMUJ5c1UwWTJxbkJLejBleWU5cFZvXG43VXdrSDJSNVNjRlVoNFhsazZ6MVQvWWFYOVBkVmRjUzlxSHlXWm5TaWtLRHI0ZVFQaGhxMi9xWjFONDBxY004XG5BZktpck40UlVSSitPdVZjc2Z0a1p6K3IxUzdsT3ZrVkk1VUpXMEtxOVI3cDZLU0RDSXRvYkE4cjdPelFBc21uXG5xZ2puNVVVYUlRS0JnUUNneDFqL2t2NnVIOUFidlNkaXRPMTQySy9IaXBEcjNBM0F6ODhDWklIK3dmSzlEdStUXG5BeW1MckRFVHdiV0tiRVZJUGhRWlI3aEtsZHNZNnhoMUFnQlpJcDArMlE5VGxlcUhwRytvclkxY1o1Zk5oQllJXG5zQ0hwOHYrak0xL1V3MHhKSGlrWVI3SFg4TXg2MmZCY0p2QXZyTkY1S0RGcHVZVnUxZzFkTE54ajRRS0JnUURFXG4xMUhjZTJ1MDh4ZDs3U2ZzNEFqVUt0UlBuRCtRM1lodFp0VWY5cWdVZEF2WGVCSENrUjNDdnQxNGtNeDV5K21PXG5UZW5nalJQOStobkZPRHBjL0tIR2hpTkZZczVRSFRZMXMxZGpGUk9YSkx3VUtPRTNQbHFqSE0zL1Y1eHdlbVVHXG5pQzRVdjAvTEhqVG9ZaWdvcXM0eU50Q0NqVGd0Zm81WThtVGp6SXpWSVFLQmdEYkQzUXlzRmRLbHk4WGR4YjVqXG5KeWF5WC9aaFowNDJHVFdSdEdLWGVrTGRDdkwzMGU4TDgxM2pHTE5QQnJRNGNGTGRaL3B0UnRBMWNGREdwOHdjXG5Dd1JzT3lhbld1MysrQXdQSFcwc2g1ZWZTNlhaWWtVRmFpMUY2OWkrc2VQUW1NZ0wrajdpaVdWQUNjQ1hmajg5XG5DeTZyOVo5M0FqeU9LdHVpWWxPcmJtenFcbi0tLS0tRU5EIFBSSVZBVEUgS0VZLS0tLS1cbiIsCiAgImNsaWVudF9lbWFpbCI6ICJmaXJlYmFzZS1hZG1pbnNkay1mYnN2Y0Bjb2xsZWdlLW91dC1wYXNzLXN5c3RlbS02MjU1Mi5pYW0uZ3NlcnZpY2VhY2NvdW50LmNvbSIKfQo=";

try {
    const decodedKey = Buffer.from(serviceAccountB64, 'base64').toString('utf8');
    const serviceAccount = JSON.parse(decodedKey);
    
    console.log("Project ID:", serviceAccount.project_id);
    console.log("Private Key Start:", serviceAccount.private_key.substring(0, 50));
    
    let key = serviceAccount.private_key;
    if (key) {
        key = key.replace(/\\n/g, '\n');
    }
    
    console.log("Modified Key Start:", key.substring(0, 50));
    
    // Check if it's valid PEM
    const lines = key.split('\n');
    console.log("First line:", lines[0]);
    console.log("Last line:", lines[lines.length - 1] || lines[lines.length - 2]);
    
    if (lines[0] !== "-----BEGIN PRIVATE KEY-----") {
        console.error("❌ Invalid start line!");
    }
    if (!lines[lines.length - 1].includes("-----END PRIVATE KEY-----") && !lines[lines.length - 2].includes("-----END PRIVATE KEY-----")) {
        console.error("❌ Invalid end line!");
    }

} catch (e) {
    console.error("Error:", e.message);
}
