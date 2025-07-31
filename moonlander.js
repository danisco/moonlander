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
        this.landingPads = [];
        
        // Background elements
        this.stars = [];
        this.earth = { x: 100, y: 80, radius: 30 };
        
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
        const segments = 80;
        const segmentWidth = this.width / segments;
        
        // Create base terrain with some variation
        for (let i = 0; i <= segments; i++) {
            const x = i * segmentWidth;
            let y = this.height - 80 + Math.sin(i * 0.1) * 30;
            
            // Add some craters
            if (i % 15 === 0 && i > 10 && i < segments - 10) {
                y += Math.random() * 40 - 20;
            }
            
            this.terrain.push({ x, y });
        }
        
        // Create landing pads (flat areas)
        this.landingPads = [
            { start: Math.floor(segments * 0.3), end: Math.floor(segments * 0.35) },
            { start: Math.floor(segments * 0.7), end: Math.floor(segments * 0.75) }
        ];
        
        // Flatten landing pads
        this.landingPads.forEach(pad => {
            const avgY = (this.terrain[pad.start].y + this.terrain[pad.end].y) / 2;
            for (let i = pad.start; i <= pad.end; i++) {
                this.terrain[i].y = avgY;
            }
        });
    }
    
    generateStars() {
        this.stars = [];
        const starCount = Math.min(200, Math.floor((this.width * this.height) / 5000));
        for (let i = 0; i < starCount; i++) {
            this.stars.push({
                x: Math.random() * this.width,
                y: Math.random() * (this.height * 0.7),
                brightness: Math.random(),
                twinkleSpeed: 0.02 + Math.random() * 0.03,
                twinklePhase: Math.random() * Math.PI * 2
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
                    const isOnLandingPad = this.landingPads.some(pad => {
                        const segmentWidth = this.width / 80;
                        return this.lander.x >= pad.start * segmentWidth && this.lander.x <= pad.end * segmentWidth;
                    });
                    
                    if (speed < 6 && Math.abs(this.lander.angle) < 0.5 && isOnLandingPad) {
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
            this.ctx.fillRect(star.x, star.y, 1, 1);
            
            // Add occasional bright sparkle
            if (brightness > 0.8 && Math.random() < 0.01) {
                this.ctx.fillStyle = '#ffff88';
                this.ctx.fillRect(star.x - 1, star.y, 3, 1);
                this.ctx.fillRect(star.x, star.y - 1, 1, 3);
            }
        });
        this.ctx.globalAlpha = 1;
        
        // Draw Earth
        this.ctx.fillStyle = '#4a90e2';
        this.ctx.beginPath();
        this.ctx.arc(this.earth.x, this.earth.y, this.earth.radius, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Draw continents on Earth
        this.ctx.fillStyle = '#2d5a2d';
        this.ctx.beginPath();
        this.ctx.arc(this.earth.x - 8, this.earth.y - 5, 8, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.beginPath();
        this.ctx.arc(this.earth.x + 6, this.earth.y + 3, 6, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Draw terrain
        this.ctx.strokeStyle = '#666';
        this.ctx.fillStyle = '#333';
        this.ctx.beginPath();
        this.ctx.moveTo(0, this.height);
        this.terrain.forEach(point => {
            this.ctx.lineTo(point.x, point.y);
        });
        this.ctx.lineTo(this.width, this.height);
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.stroke();
        
        // Highlight landing pads
        this.ctx.strokeStyle = '#0f0';
        this.ctx.lineWidth = 3;
        this.landingPads.forEach(pad => {
            const segmentWidth = this.width / 80;
            const startX = pad.start * segmentWidth;
            const endX = pad.end * segmentWidth;
            const y = this.terrain[pad.start].y;
            
            this.ctx.beginPath();
            this.ctx.moveTo(startX, y);
            this.ctx.lineTo(endX, y);
            this.ctx.stroke();
        });
        this.ctx.lineWidth = 1;
        
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