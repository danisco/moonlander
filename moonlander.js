class MoonLander {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.resizeCanvas();
        
        // Add resize listener
        window.addEventListener('resize', () => this.resizeCanvas());
        
        // Game state
        this.gameState = 'playing'; // 'playing', 'crashed', 'landed'
        this.gameStarted = false;
        this.keys = {};
        
        // Physics constants (Moon gravity)
        this.MOON_GRAVITY = 1.62; // m/s²
        this.THRUST_POWER = 3.5;
        this.SIDE_THRUST_POWER = 2.0;
        this.FUEL_CONSUMPTION = 0.5;
        
        // Lander properties
        this.lander = {
            x: this.width / 2,
            y: 50,
            vx: 0, // horizontal velocity
            vy: 0, // vertical velocity
            angle: 0,
            fuel: 100,
            width: 20,
            height: 30
        };
        
        // Terrain
        this.terrain = [];
        
        // Background elements
        this.stars = [];
        this.earth = { x: 100, y: 80, radius: 50 }; // Larger Earth
        
        // Explosion particles
        this.particles = [];
        
        // Flag animation
        this.flag = { visible: false, height: 0, maxHeight: 40 };
        
        this.init();
    }
    
    init() {
        this.generateTerrain();
        this.generateStars();
        this.setupEventListeners();
        this.gameLoop();
    }
    
    resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.width = this.canvas.width;
        this.height = this.canvas.height;
        
        // Reinitialize game elements that depend on canvas size
        if (this.lander && !this.gameStarted) {
            this.lander.x = this.width / 2;
        }
        if (this.earth) {
            this.earth.x = this.width * 0.1;
            this.earth.y = this.height * 0.1;
        }
    }
    
    generateTerrain() {
        this.terrain = [];
        this.craters = [];
        const segments = 100;
        const segmentWidth = this.width / segments;
        const baseY = this.height - 80;
        
        // Generate realistic moon terrain - mostly flat with gentle rolling hills and occasional craters
        let currentY = baseY;
        let slopeDirection = 0;
        let flatStretch = 0;
        
        for (let i = 0; i <= segments; i++) {
            const x = i * segmentWidth;
            
            // Create flat stretches more frequently
            if (flatStretch > 0) {
                // Continue flat surface
                flatStretch--;
                currentY += (Math.random() - 0.5) * 2; // Very small variation
            } else {
                // Randomly start a flat stretch
                if (Math.random() < 0.3) {
                    flatStretch = 8 + Math.floor(Math.random() * 12); // 8-20 segments of flat terrain
                }
                
                // Gentle slope changes - moon has rolling hills, not sharp peaks
                if (Math.random() < 0.1) {
                    slopeDirection = (Math.random() - 0.5) * 0.8; // Very gentle slopes
                }
                
                // Apply gentle slope and small random variation
                currentY += slopeDirection + (Math.random() - 0.5) * 8;
            }
            
            // Keep terrain in reasonable bounds - no extreme heights
            currentY = Math.max(this.height * 0.7, Math.min(this.height - 60, currentY));
            
            this.terrain.push({ x, y: currentY });
            
            // Add occasional craters (less frequent)
            if (Math.random() < 0.04 && i > 8 && i < segments - 8) {
                this.addCrater(i, segments);
                flatStretch = 0; // Reset flat stretch after crater
            }
        }
        
        // Light smoothing to ensure no impossible slopes
        this.smoothTerrain();
    }
    
    addCrater(centerIndex, totalSegments) {
        const craterWidth = 5 + Math.random() * 15;
        const craterDepth = 20 + Math.random() * 40;
        const startIndex = Math.max(0, centerIndex - Math.floor(craterWidth / 2));
        const endIndex = Math.min(totalSegments, centerIndex + Math.floor(craterWidth / 2));
        
        const crater = {
            x: this.terrain[centerIndex].x,
            y: this.terrain[centerIndex].y,
            width: craterWidth * (this.width / totalSegments),
            depth: craterDepth
        };
        this.craters.push(crater);
        
        // Create crater shape
        for (let i = startIndex; i <= endIndex; i++) {
            if (i < this.terrain.length) {
                const progress = Math.abs(i - centerIndex) / (craterWidth / 2);
                const craterY = this.terrain[i].y + craterDepth * Math.cos(progress * Math.PI / 2);
                this.terrain[i].y = Math.max(this.terrain[i].y, craterY);
            }
        }
    }
    
    smoothTerrain() {
        // Light smoothing to prevent impossible slopes
        for (let i = 1; i < this.terrain.length - 1; i++) {
            const prev = this.terrain[i - 1].y;
            const curr = this.terrain[i].y;
            const next = this.terrain[i + 1].y;
            
            // If slope is too extreme, moderate it slightly - moon terrain is gentler
            const maxChange = 25;
            if (Math.abs(curr - prev) > maxChange) {
                this.terrain[i].y = prev + Math.sign(curr - prev) * maxChange;
            }
        }
    }
    
    generateStars() {
        this.stars = [];
        const starCount = Math.min(500, Math.floor((this.width * this.height) / 2000)); // More stars
        for (let i = 0; i < starCount; i++) {
            this.stars.push({
                x: Math.random() * this.width,
                y: Math.random() * (this.height * 0.8), // Stars higher up too
                brightness: Math.random(),
                twinkleSpeed: 0.01 + Math.random() * 0.02,
                twinklePhase: Math.random() * Math.PI * 2,
                size: Math.random() < 0.1 ? 2 : 1 // Some bigger stars
            });
        }
    }
    
    setupEventListeners() {
        document.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
            if (e.code === 'KeyR' && this.gameState !== 'playing') {
                this.restart();
            }
        });
        
        document.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });
    }
    
    update() {
        if (this.gameState !== 'playing') {
            this.updateParticles();
            if (this.gameState === 'landed') {
                this.updateFlag();
            }
            return;
        }
        
        // Apply gravity
        this.lander.vy += this.MOON_GRAVITY / 60; // 60 FPS
        
        // Handle thrust
        if (this.keys['ArrowUp'] && this.lander.fuel > 0) {
            this.gameStarted = true;
            this.lander.vy -= this.THRUST_POWER / 60;
            this.lander.fuel -= this.FUEL_CONSUMPTION / 60;
            this.createThrustParticles(this.lander.x, this.lander.y + this.lander.height, 0, 1);
        }
        
        if (this.keys['ArrowLeft'] && this.lander.fuel > 0) {
            this.gameStarted = true;
            this.lander.vx -= this.SIDE_THRUST_POWER / 60;
            this.lander.fuel -= this.FUEL_CONSUMPTION / 60;
            this.lander.angle = -0.1;
            this.createThrustParticles(this.lander.x + this.lander.width/2, this.lander.y + this.lander.height/2, 1, 0);
        } else if (this.keys['ArrowRight'] && this.lander.fuel > 0) {
            this.gameStarted = true;
            this.lander.vx += this.SIDE_THRUST_POWER / 60;
            this.lander.fuel -= this.FUEL_CONSUMPTION / 60;
            this.lander.angle = 0.1;
            this.createThrustParticles(this.lander.x - this.lander.width/2, this.lander.y + this.lander.height/2, -1, 0);
        } else {
            this.lander.angle *= 0.9; // Gradually return to upright
        }
        
        // Update position
        this.lander.x += this.lander.vx;
        this.lander.y += this.lander.vy;
        
        // Keep lander in bounds horizontally
        if (this.lander.x < 0) this.lander.x = this.width;
        if (this.lander.x > this.width) this.lander.x = 0;
        
        // Check collision
        this.checkCollision();
        
        // Update particles
        this.updateParticles();
        
        // Update instruments
        this.updateInstruments();
    }
    
    createThrustParticles(x, y, dx, dy) {
        for (let i = 0; i < 3; i++) {
            this.particles.push({
                x: x + (Math.random() - 0.5) * 10,
                y: y + (Math.random() - 0.5) * 10,
                vx: dx * (2 + Math.random() * 2) + (Math.random() - 0.5) * 0.5,
                vy: dy * (2 + Math.random() * 2) + (Math.random() - 0.5) * 0.5,
                life: 30,
                maxLife: 30,
                color: `hsl(${30 + Math.random() * 30}, 100%, ${50 + Math.random() * 50}%)`
            });
        }
    }
    
    createExplosionParticles(x, y) {
        for (let i = 0; i < 20; i++) {
            this.particles.push({
                x: x,
                y: y,
                vx: (Math.random() - 0.5) * 10,
                vy: (Math.random() - 0.5) * 10,
                life: 60,
                maxLife: 60,
                color: `hsl(${Math.random() * 60}, 100%, ${50 + Math.random() * 50}%)`
            });
        }
    }
    
    updateParticles() {
        this.particles = this.particles.filter(particle => {
            particle.x += particle.vx;
            particle.y += particle.vy;
            particle.life--;
            return particle.life > 0;
        });
    }
    
    updateFlag() {
        if (this.flag.height < this.flag.maxHeight) {
            this.flag.height += 0.5;
        }
    }
    
    checkFlatSurface(landerX) {
        const landerWidth = this.lander.width * 0.8; // Check area slightly smaller than lander
        const segmentWidth = this.width / 100; // Updated for new segment count
        const centerSegment = Math.floor(landerX / segmentWidth);
        const checkRadius = Math.ceil(landerWidth / segmentWidth / 2);
        
        // Get terrain points around lander position
        const points = [];
        for (let i = centerSegment - checkRadius; i <= centerSegment + checkRadius; i++) {
            if (i >= 0 && i < this.terrain.length) {
                points.push(this.terrain[i]);
            }
        }
        
        if (points.length < 3) return false;
        
        // Check if surface is relatively flat - more lenient since terrain is gentler
        const maxHeightDiff = 15; // Maximum height difference allowed
        const minY = Math.min(...points.map(p => p.y));
        const maxY = Math.max(...points.map(p => p.y));
        
        return (maxY - minY) <= maxHeightDiff;
    }
    
    checkCollision() {
        const landerBottom = this.lander.y + this.lander.height;
        const landerLeft = this.lander.x - this.lander.width / 2;
        const landerRight = this.lander.x + this.lander.width / 2;
        
        // Find terrain height at lander position
        for (let i = 0; i < this.terrain.length - 1; i++) {
            const t1 = this.terrain[i];
            const t2 = this.terrain[i + 1];
            
            if (this.lander.x >= t1.x && this.lander.x <= t2.x) {
                const ratio = (this.lander.x - t1.x) / (t2.x - t1.x);
                const terrainHeight = t1.y + (t2.y - t1.y) * ratio;
                
                if (landerBottom >= terrainHeight) {
                    // Check if it's a safe landing
                    const speed = Math.sqrt(this.lander.vx * this.lander.vx + this.lander.vy * this.lander.vy);
                    // Check if landing area is flat enough
                    const isOnFlatSurface = this.checkFlatSurface(this.lander.x);
                    
                    if (speed < 3 && Math.abs(this.lander.angle) < 0.3 && isOnFlatSurface) {
                        // Safe landing
                        this.gameState = 'landed';
                        this.lander.vx = 0;
                        this.lander.vy = 0;
                        this.flag.visible = true;
                        this.showMessage('SUCCESS!<br>Eagle has landed!', '#0f0');
                    } else {
                        // Crash
                        this.gameState = 'crashed';
                        this.createExplosionParticles(this.lander.x, this.lander.y);
                        this.showMessage('CRASHED!<br>Mission Failed', '#f00');
                    }
                    break;
                }
            }
        }
    }
    
    showMessage(text, color = '#fff') {
        const messageEl = document.getElementById('gameMessage');
        const textEl = document.getElementById('messageText');
        textEl.innerHTML = text;
        textEl.style.color = color;
        messageEl.style.display = 'block';
    }
    
    updateInstruments() {
        const altitude = Math.max(0, Math.round(this.height - this.lander.y - 100));
        document.getElementById('altitude').textContent = altitude;
        document.getElementById('vSpeed').textContent = Math.round(this.lander.vy * 10) / 10;
        document.getElementById('hSpeed').textContent = Math.round(this.lander.vx * 10) / 10;
        document.getElementById('fuel').textContent = Math.max(0, Math.round(this.lander.fuel));
    }
    
    render() {
        // Clear canvas
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, this.width, this.height);
        
        // Draw stars with twinkling effect
        this.stars.forEach(star => {
            star.twinklePhase += star.twinkleSpeed;
            const twinkle = Math.sin(star.twinklePhase) * 0.3 + 0.7;
            const brightness = star.brightness * twinkle;
            
            this.ctx.globalAlpha = brightness;
            this.ctx.fillStyle = '#fff';
            
            if (star.size === 2) {
                // Bigger, brighter stars
                this.ctx.fillRect(star.x - 1, star.y - 1, 2, 2);
                if (brightness > 0.7) {
                    this.ctx.fillStyle = '#ffffaa';
                    this.ctx.fillRect(star.x - 2, star.y, 4, 1);
                    this.ctx.fillRect(star.x, star.y - 2, 1, 4);
                }
            } else {
                this.ctx.fillRect(star.x, star.y, 1, 1);
            }
            
            // Add occasional bright sparkle
            if (brightness > 0.8 && Math.random() < 0.005) {
                this.ctx.fillStyle = '#ffff88';
                this.ctx.fillRect(star.x - 1, star.y, 3, 1);
                this.ctx.fillRect(star.x, star.y - 1, 1, 3);
            }
        });
        this.ctx.globalAlpha = 1;
        
        // Draw Earth with realistic appearance
        const earthX = this.earth.x;
        const earthY = this.earth.y;
        const earthR = this.earth.radius;
        
        // Earth atmosphere glow
        const gradient = this.ctx.createRadialGradient(earthX, earthY, earthR * 0.8, earthX, earthY, earthR * 1.2);
        gradient.addColorStop(0, 'rgba(135, 206, 250, 0.3)');
        gradient.addColorStop(1, 'rgba(135, 206, 250, 0)');
        this.ctx.fillStyle = gradient;
        this.ctx.beginPath();
        this.ctx.arc(earthX, earthY, earthR * 1.2, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Earth base - blue oceans
        this.ctx.fillStyle = '#1e3a8a';
        this.ctx.beginPath();
        this.ctx.arc(earthX, earthY, earthR, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Continents - realistic shapes
        this.ctx.fillStyle = '#16a34a';
        
        // North America
        this.ctx.beginPath();
        this.ctx.ellipse(earthX - earthR * 0.3, earthY - earthR * 0.2, earthR * 0.25, earthR * 0.4, -0.2, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Europe/Africa
        this.ctx.beginPath();
        this.ctx.ellipse(earthX + earthR * 0.1, earthY - earthR * 0.1, earthR * 0.15, earthR * 0.5, 0.1, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Asia
        this.ctx.beginPath();
        this.ctx.ellipse(earthX + earthR * 0.4, earthY - earthR * 0.3, earthR * 0.2, earthR * 0.3, 0.3, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Cloud swirls
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        this.ctx.beginPath();
        this.ctx.ellipse(earthX - earthR * 0.2, earthY + earthR * 0.3, earthR * 0.3, earthR * 0.1, 0.5, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.ctx.beginPath();
        this.ctx.ellipse(earthX + earthR * 0.3, earthY - earthR * 0.4, earthR * 0.2, earthR * 0.08, -0.3, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Terminator line (day/night)
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        this.ctx.beginPath();
        this.ctx.arc(earthX, earthY, earthR, Math.PI * 0.3, Math.PI * 1.3);
        this.ctx.closePath();
        this.ctx.fill();
        
        // Draw moon terrain with realistic coloring and shadows
        
        // Main terrain fill - light gray like moon dust
        this.ctx.fillStyle = '#d1d5db';
        this.ctx.beginPath();
        this.ctx.moveTo(0, this.height);
        this.terrain.forEach(point => {
            this.ctx.lineTo(point.x, point.y);
        });
        this.ctx.lineTo(this.width, this.height);
        this.ctx.closePath();
        this.ctx.fill();
        
        // Terrain outline - darker gray
        this.ctx.strokeStyle = '#9ca3af';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.terrain.forEach((point, i) => {
            if (i === 0) {
                this.ctx.moveTo(point.x, point.y);
            } else {
                this.ctx.lineTo(point.x, point.y);
            }
        });
        this.ctx.stroke();
        
        // Add shadows on steep slopes
        this.ctx.fillStyle = '#6b7280';
        for (let i = 1; i < this.terrain.length; i++) {
            const prev = this.terrain[i - 1];
            const curr = this.terrain[i];
            const slope = (curr.y - prev.y) / (curr.x - prev.x);
            
            // Add shadow for steep downward slopes
            if (slope > 0.5) {
                this.ctx.beginPath();
                this.ctx.moveTo(prev.x, prev.y);
                this.ctx.lineTo(curr.x, curr.y);
                this.ctx.lineTo(curr.x, this.height);
                this.ctx.lineTo(prev.x, this.height);
                this.ctx.closePath();
                this.ctx.fill();
            }
        }
        
        
        
        // Draw particles
        this.particles.forEach(particle => {
            const alpha = particle.life / particle.maxLife;
            this.ctx.globalAlpha = alpha;
            this.ctx.fillStyle = particle.color;
            this.ctx.fillRect(particle.x - 1, particle.y - 1, 2, 2);
        });
        this.ctx.globalAlpha = 1;
        
        // Draw lander (if not crashed)
        if (this.gameState !== 'crashed') {
            this.ctx.save();
            this.ctx.translate(this.lander.x, this.lander.y);
            this.ctx.rotate(this.lander.angle);
            
            // Apollo Lunar Module design
            const w = this.lander.width;
            const h = this.lander.height;
            
            // Main body (descent stage) - hexagonal shape
            this.ctx.fillStyle = '#d4af37'; // Gold foil color
            this.ctx.beginPath();
            this.ctx.moveTo(-w/2, h * 0.4);
            this.ctx.lineTo(-w/3, h * 0.8);
            this.ctx.lineTo(w/3, h * 0.8);
            this.ctx.lineTo(w/2, h * 0.4);
            this.ctx.lineTo(w/3, 0);
            this.ctx.lineTo(-w/3, 0);
            this.ctx.closePath();
            this.ctx.fill();
            this.ctx.strokeStyle = '#b8860b';
            this.ctx.lineWidth = 1;
            this.ctx.stroke();
            
            // Ascent stage (top part)
            this.ctx.fillStyle = '#c0c0c0';
            this.ctx.beginPath();
            this.ctx.moveTo(-w/3, 0);
            this.ctx.lineTo(-w/4, -h * 0.3);
            this.ctx.lineTo(w/4, -h * 0.3);
            this.ctx.lineTo(w/3, 0);
            this.ctx.closePath();
            this.ctx.fill();
            this.ctx.strokeStyle = '#999';
            this.ctx.stroke();
            
            // Windows
            this.ctx.fillStyle = '#87ceeb'; // Sky blue for windows
            this.ctx.fillRect(-w/6, -h * 0.2, w/8, h/8);
            this.ctx.fillRect(w/12, -h * 0.2, w/8, h/8);
            this.ctx.strokeStyle = '#333';
            this.ctx.strokeRect(-w/6, -h * 0.2, w/8, h/8);
            this.ctx.strokeRect(w/12, -h * 0.2, w/8, h/8);
            
            // Landing legs (4 legs)
            this.ctx.strokeStyle = '#666';
            this.ctx.lineWidth = 3;
            const legExtension = w * 0.8;
            
            // Leg 1 (front left)
            this.ctx.beginPath();
            this.ctx.moveTo(-w/3, h * 0.6);
            this.ctx.lineTo(-legExtension, h + 8);
            this.ctx.stroke();
            // Foot pad
            this.ctx.fillStyle = '#444';
            this.ctx.fillRect(-legExtension - 4, h + 8, 8, 3);
            
            // Leg 2 (front right)
            this.ctx.beginPath();
            this.ctx.moveTo(w/3, h * 0.6);
            this.ctx.lineTo(legExtension, h + 8);
            this.ctx.stroke();
            // Foot pad
            this.ctx.fillRect(legExtension - 4, h + 8, 8, 3);
            
            // Leg 3 (back left) - shorter for perspective
            this.ctx.beginPath();
            this.ctx.moveTo(-w/4, h * 0.7);
            this.ctx.lineTo(-legExtension * 0.7, h + 6);
            this.ctx.stroke();
            // Foot pad
            this.ctx.fillRect(-legExtension * 0.7 - 3, h + 6, 6, 2);
            
            // Leg 4 (back right) - shorter for perspective
            this.ctx.beginPath();
            this.ctx.moveTo(w/4, h * 0.7);
            this.ctx.lineTo(legExtension * 0.7, h + 6);
            this.ctx.stroke();
            // Foot pad
            this.ctx.fillRect(legExtension * 0.7 - 3, h + 6, 6, 2);
            
            // Main thruster nozzle
            this.ctx.fillStyle = '#444';
            this.ctx.beginPath();
            this.ctx.moveTo(-4, h * 0.8);
            this.ctx.lineTo(-6, h + 8);
            this.ctx.lineTo(6, h + 8);
            this.ctx.lineTo(4, h * 0.8);
            this.ctx.closePath();
            this.ctx.fill();
            
            // Side RCS thrusters
            this.ctx.fillStyle = '#666';
            this.ctx.fillRect(-w/2 - 2, h * 0.3, 4, 3);
            this.ctx.fillRect(w/2 - 2, h * 0.3, 4, 3);
            
            // Details - antenna
            this.ctx.strokeStyle = '#999';
            this.ctx.lineWidth = 1;
            this.ctx.beginPath();
            this.ctx.moveTo(0, -h * 0.3);
            this.ctx.lineTo(0, -h * 0.5);
            this.ctx.stroke();
            
            this.ctx.restore();
        }
        
        // Draw flag if landed
        if (this.flag.visible && this.gameState === 'landed') {
            const flagX = this.lander.x + 15;
            const flagY = this.lander.y + this.lander.height - this.flag.height;
            
            // Flag pole
            this.ctx.strokeStyle = '#888';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.moveTo(flagX, this.lander.y + this.lander.height);
            this.ctx.lineTo(flagX, flagY);
            this.ctx.stroke();
            
            // American flag
            if (this.flag.height > 10) {
                const flagWidth = 20;
                const flagHeight = 12;
                
                // Flag background (red and white stripes)
                this.ctx.fillStyle = '#ff0000';
                this.ctx.fillRect(flagX, flagY, flagWidth, flagHeight);
                
                for (let i = 1; i < 7; i++) {
                    if (i % 2 === 0) {
                        this.ctx.fillStyle = '#ffffff';
                        this.ctx.fillRect(flagX, flagY + i * 2, flagWidth, 2);
                    }
                }
                
                // Blue canton
                this.ctx.fillStyle = '#0000ff';
                this.ctx.fillRect(flagX, flagY, flagWidth * 0.4, flagHeight * 0.5);
                
                // Stars (simplified as white dots)
                this.ctx.fillStyle = '#ffffff';
                for (let row = 0; row < 3; row++) {
                    for (let col = 0; col < 3; col++) {
                        const starX = flagX + 2 + col * 2;
                        const starY = flagY + 1 + row * 2;
                        this.ctx.fillRect(starX, starY, 1, 1);
                    }
                }
            }
        }
    }
    
    restart() {
        this.gameState = 'playing';
        this.gameStarted = false;
        this.lander = {
            x: this.width / 2,
            y: 50,
            vx: 0,
            vy: 0,
            angle: 0,
            fuel: 100,
            width: 20,
            height: 30
        };
        this.particles = [];
        this.flag = { visible: false, height: 0, maxHeight: 40 };
        
        // Regenerate terrain and stars for current screen size
        this.generateTerrain();
        this.generateStars();
        
        document.getElementById('gameMessage').style.display = 'none';
    }
    
    gameLoop() {
        this.update();
        this.render();
        requestAnimationFrame(() => this.gameLoop());
    }
}

// Start the game
window.addEventListener('load', () => {
    new MoonLander();
});