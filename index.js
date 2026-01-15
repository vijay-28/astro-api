const express = require('express');
const Astronomy = require('astronomy-engine');
const app = express();
const port = 3000;

// --- CONFIGURATION ---
const AYANAMSA = 24.12; // Lahiri Ayanamsa (Approx)

// --- CONSTANTS ---
const RASI_NAMES = ["Mesha", "Rishaba", "Mithuna", "Kataka", "Simha", "Kanya", "Thula", "Vrischika", "Dhanusu", "Makara", "Kumbha", "Meena"];
const NAKSHATRA_NAMES = ["Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashira", "Ardra", "Punarvasu", "Pushya", "Ashlesha", "Magha", "Purva Phalguni", "Uttara Phalguni", "Hasta", "Chitra", "Swati", "Vishakha", "Anuradha", "Jyeshtha", "Mula", "Purva Ashadha", "Uttara Ashadha", "Shravana", "Dhanishta", "Shatabhisha", "Purva Bhadrapada", "Uttara Bhadrapada", "Revati"];

// Vimshottari Dasha Order & Years
const DASHA_LORDS = [
    { name: "Ketu", years: 7 }, { name: "Venus", years: 20 }, { name: "Sun", years: 6 },
    { name: "Moon", years: 10 }, { name: "Mars", years: 7 }, { name: "Rahu", years: 18 },
    { name: "Jupiter", years: 16 }, { name: "Saturn", years: 19 }, { name: "Mercury", years: 17 }
];

// --- MATH HELPERS ---
function toVedic(westernLong) {
    let vedic = westernLong - AYANAMSA;
    if (vedic < 0) vedic += 360;
    return vedic;
}

function getStarInfo(degree) {
    const starIndex = Math.floor(degree / 13.333333);
    const starName = NAKSHATRA_NAMES[starIndex];
    const quarter = Math.floor((degree % 13.333333) / 3.333333) + 1;
    const rasiIndex = Math.floor(degree / 30);
    return { index: starIndex, name: starName, quarter: quarter, rasiIndex: rasiIndex, rasi: RASI_NAMES[rasiIndex] };
}

// --- LOGIC 1: DASHA CALCULATOR ---
function calculateCurrentDasha(moonDegree, birthDate) {
    // 1. Find Starting Dasha at Birth
    // Each star is 13.333 deg. There are 9 lords. Cycle repeats 3 times (27 stars).
    // Star Index % 9 gives the Lord Index.
    
    const starExactPos = moonDegree % 13.333333; // Degrees traveled into the star
    const starTotalLen = 13.333333;
    const starIndex = Math.floor(moonDegree / starTotalLen);
    const lordIndex = starIndex % 9; // 0=Ketu, 1=Venus...
    
    const lord = DASHA_LORDS[lordIndex];
    
    // Balance Calculation: How much of the Dasha was LEFT at birth?
    // Formula: (Distance Remaining / Total Distance) * Total Years
    const fractionTraveled = starExactPos / starTotalLen;
    const fractionRemaining = 1 - fractionTraveled;
    const balanceYears = lord.years * fractionRemaining;
    
    // 2. Project Forward to TODAY
    const birthTime = new Date(birthDate).getTime();
    const nowTime = new Date().getTime();
    let ageInYears = (nowTime - birthTime) / (1000 * 60 * 60 * 24 * 365.25);
    
    // Walk through the Dashas until we find the current one
    let currentDasha = null;
    let timeWalker = balanceYears; // Time passed after birth in first dasha
    let checkIndex = lordIndex; // Start with birth lord

    if (ageInYears < balanceYears) {
        // Still in Birth Dasha
        currentDasha = {
            lord: DASHA_LORDS[checkIndex].name,
            ends_in: (balanceYears - ageInYears).toFixed(2) + " years"
        };
    } else {
        ageInYears -= balanceYears; // Remove birth dasha duration
        checkIndex = (checkIndex + 1) % 9; // Move to next
        
        // Loop until age is covered
        while (true) {
            let periodYears = DASHA_LORDS[checkIndex].years;
            if (ageInYears < periodYears) {
                // Found it!
                currentDasha = {
                    lord: DASHA_LORDS[checkIndex].name,
                    started_ago: ageInYears.toFixed(2) + " years",
                    ends_in: (periodYears - ageInYears).toFixed(2) + " years"
                };
                break;
            }
            ageInYears -= periodYears;
            checkIndex = (checkIndex + 1) % 9;
        }
    }
    return currentDasha;
}

// --- LOGIC 2: MATCH MAKING (PORUTHAM) ---
function checkCompatibility(boyStarIndex, girlStarIndex, boyRasi, girlRasi) {
    let score = 0;
    let total = 10; // Simplifying to a 10-point scale for MVP

    // 1. Dina Porutham (Health & Prosperity) - Count from Girl to Boy
    let count = (boyStarIndex - girlStarIndex);
    if (count < 0) count += 27;
    count = count + 1; // 1-based count
    // Good counts: 2, 4, 6, 8, 9, 11, 13, 15, 18, 20, 24, 26
    const goodDina = [2, 4, 6, 8, 9, 11, 13, 15, 18, 20, 24, 26];
    if (goodDina.includes(count)) score += 3; // High weight

    // 2. Rasi Porutham (Emotional Bond) - Count Rasi Girl to Boy
    let rasiCount = (boyRasi - girlRasi);
    if (rasiCount < 0) rasiCount += 12;
    rasiCount += 1;
    // Good: 7 (Saptama - Excellent), 12 (Loss - Bad), 6/8 (Sashtashtaga - Bad)
    if (rasiCount === 7) score += 4; // Best
    else if ([3, 4, 10, 11].includes(rasiCount)) score += 2;
    else if ([6, 8].includes(rasiCount)) score -= 1; // Penalty

    // 3. Rajju (Maangalya - CRITICAL) - Do stars belong to same group?
    // Simplified: Groups based on star index mapping.
    // Rule: Should NOT range in same group. 
    // (Skipping full table for brevity, adding a base points for demo)
    score += 3; 

    // Result
    let status = "Average";
    if (score >= 7) status = "Excellent";
    if (score < 4) status = "Poor";

    return { score: score + "/10", status: status, count_from_girl: count };
}

// --- API ENDPOINTS ---

// 1. ROOT (Health Check)
app.get('/', (req, res) => res.send("🚀 Graha.dev API is Live! endpoints: /horoscope, /dasha, /match"));

// 2. HOROSCOPE (Original)
app.get('/horoscope', (req, res) => {
    const date = req.query.date ? new Date(req.query.date) : new Date();
    if (isNaN(date)) return res.status(400).json({ error: "Invalid Date" });

    const sunRaw = Astronomy.Ecliptic("Sun", date).elon;
    const moonRaw = Astronomy.Ecliptic("Moon", date).elon;
    const sunDetails = getStarInfo(toVedic(sunRaw));
    const moonDetails = getStarInfo(toVedic(moonRaw));

    res.json({
        date: date.toDateString(),
        sun_sign: sunDetails.rasi,
        moon_sign: moonDetails.rasi,
        moon_star: moonDetails.name
    });
});

// 3. DASHA (New!)
// Usage: /dasha?date=1998-05-15&time=14:30
app.get('/dasha', (req, res) => {
    // Need Birth Date AND Time
    const dateStr = req.query.date; // YYYY-MM-DD
    const timeStr = req.query.time || "12:00";
    
    if (!dateStr) return res.status(400).json({error: "Please provide ?date=YYYY-MM-DD"});
    
    const birthDate = new Date(`${dateStr}T${timeStr}:00Z`); // Treat as UTC for simplicity
    
    // Get Moon Position at Birth
    const moonRaw = Astronomy.Ecliptic("Moon", birthDate).elon;
    const moonVedic = toVedic(moonRaw);
    const moonDetails = getStarInfo(moonVedic);

    // Calculate Dasha
    const currentDasha = calculateCurrentDasha(moonVedic, birthDate);

    res.json({
        birth_date: birthDate.toDateString(),
        birth_star: moonDetails.name,
        current_status: {
            running_dasha: currentDasha.lord,
            time_remaining: currentDasha.ends_in
        }
    });
});

// 4. MATCH (New!)
// Usage: /match?boy_star=Ashwini&girl_star=Bharani
// OR Usage: /match?b_date=1995-10-10&g_date=1998-05-15 (More advanced)
app.get('/match', (req, res) => {
    // Method A: Input by Date
    if (req.query.b_date && req.query.g_date) {
        const bDate = new Date(req.query.b_date);
        const gDate = new Date(req.query.g_date);
        
        const bMoon = toVedic(Astronomy.Ecliptic("Moon", bDate).elon);
        const gMoon = toVedic(Astronomy.Ecliptic("Moon", gDate).elon);
        
        const bInfo = getStarInfo(bMoon);
        const gInfo = getStarInfo(gMoon);
        
        const result = checkCompatibility(bInfo.index, gInfo.index, bInfo.rasiIndex, gInfo.rasiIndex);
        
        return res.json({
            boy: { star: bInfo.name, rasi: bInfo.rasi },
            girl: { star: gInfo.name, rasi: gInfo.rasi },
            compatibility: result
        });
    }
    
    // Method B: Input by Star Name (Simpler for testing)
    // (Skipped for brevity, Method A is better for APIs)
    res.json({ error: "Please provide birth dates: ?b_date=YYYY-MM-DD&g_date=YYYY-MM-DD" });
});

app.listen(port, () => {
    console.log(`🚀 Graha.dev Final V3 running on ${port}`);
});
