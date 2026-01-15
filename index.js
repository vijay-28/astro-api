const express = require('express');
const ephemeris = require('ephemeris');
const app = express();
const port = 3000;

// HELPER: Vedic Logic
function getVedicSign(longitude) {
    const ayanamsa = 24.12; 
    let vedicDegree = longitude - ayanamsa;
    if (vedicDegree < 0) vedicDegree += 360;

    const rasiNames = ["Mesha", "Rishaba", "Mithuna", "Kataka", "Simha", "Kanya", "Thula", "Vrischika", "Dhanusu", "Makara", "Kumbha", "Meena"];
    const index = Math.floor(vedicDegree / 30);
    
    return {
        rasi: rasiNames[index],
        degree: vedicDegree.toFixed(2)
    };
}

// THE API ENDPOINT
// This is what listens for the URL click
app.get('/planets', (req, res) => {
    const date = new Date(); // Uses current time
    const result = ephemeris.getAllPlanets(date, 0, 0, 0);
    const bodies = ['sun', 'moon', 'mars', 'mercury', 'jupiter', 'venus', 'saturn'];
    
    // Build the JSON response
    let responseData = {
        date: date.toDateString(),
        planets: []
    };

    bodies.forEach(body => {
        const rawData = result.observed[body];
        const vedic = getVedicSign(rawData.apparentLongitudeDd);
        
        responseData.planets.push({
            name: body.charAt(0).toUpperCase() + body.slice(1),
            rasi: vedic.rasi,
            degree: vedic.degree
        });
    });

    // Send JSON back to the user
    res.json(responseData);
});

// START THE SERVER
app.listen(port, () => {
    console.log(`🚀 API is running!`);
    console.log(`Waiting for requests on port ${port}...`);
});
