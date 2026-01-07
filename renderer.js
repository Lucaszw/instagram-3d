// ========================================
// CreativeInstagram - 3D Renderer
// Pokemon-style 3D world using Three.js
// ========================================

class GameRenderer {
  constructor(container) {
    this.container = container;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.player = null;
    this.buildings = [];
    this.npcs = [];
    this.decorations = [];
    this.particles = [];
    this.clock = new THREE.Clock();
    this.closestNPC = null;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    
    // Movement
    this.moveDirection = { forward: false, backward: false, left: false, right: false };
    this.playerVelocity = new THREE.Vector3();
    this.playerSpeed = 0.15;
    this.cameraOffset = new THREE.Vector3(0, 15, 15);
    
    // Interaction
    this.interactables = [];
    this.nearestInteractable = null;
    
    this.init();
  }

  init() {
    // Ensure container has valid dimensions
    let width = this.container.clientWidth || window.innerWidth;
    let height = this.container.clientHeight || window.innerHeight;
    
    console.log('Initializing renderer with dimensions:', width, 'x', height);
    
    // Scene
    this.scene = new THREE.Scene();
    // Use a slightly brighter background so we can see it's rendering
    this.scene.background = new THREE.Color(0x2a2a4e);
    this.scene.fog = new THREE.Fog(0x2a2a4e, 30, 100);

    // Camera
    this.camera = new THREE.PerspectiveCamera(
      60,
      width / height,
      0.1,
      1000
    );
    this.camera.position.set(0, 15, 15);
    this.camera.lookAt(0, 0, 0);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      alpha: false  // Ensure scene background is visible
    });
    this.renderer.setClearColor(0x2a2a4e, 1); // Force clear color
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);
    
    // Force the canvas to fill container
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    
    // Debug: check canvas
    console.log('Canvas added to DOM:', this.renderer.domElement);
    console.log('Canvas parent:', this.renderer.domElement.parentElement);
    console.log('Canvas dimensions:', this.renderer.domElement.width, 'x', this.renderer.domElement.height);
    console.log('Container dimensions:', this.container.clientWidth, 'x', this.container.clientHeight);
    console.log('WebGL context:', this.renderer.getContext());

    // Lighting
    this.setupLighting();

    // Create world
    this.createGround();
    this.createPlayer();
    this.createInstagramWorld();
    this.createParticles();

    // Events
    window.addEventListener('resize', () => this.onResize());
    
    // Start animation loop
    this.animate();
  }

  setupLighting() {
    // Ambient light
    const ambient = new THREE.AmbientLight(0x404060, 0.5);
    this.scene.add(ambient);

    // Main directional light (sun/moon)
    const mainLight = new THREE.DirectionalLight(0xffffff, 0.8);
    mainLight.position.set(50, 100, 50);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 2048;
    mainLight.shadow.mapSize.height = 2048;
    mainLight.shadow.camera.near = 0.5;
    mainLight.shadow.camera.far = 200;
    mainLight.shadow.camera.left = -50;
    mainLight.shadow.camera.right = 50;
    mainLight.shadow.camera.top = 50;
    mainLight.shadow.camera.bottom = -50;
    this.scene.add(mainLight);

    // Pink accent light
    const pinkLight = new THREE.PointLight(0xff6b9d, 1, 50);
    pinkLight.position.set(-10, 10, -10);
    this.scene.add(pinkLight);

    // Cyan accent light
    const cyanLight = new THREE.PointLight(0x61dafb, 1, 50);
    cyanLight.position.set(10, 10, 10);
    this.scene.add(cyanLight);

    // Purple center light
    const purpleLight = new THREE.PointLight(0xc678dd, 0.8, 40);
    purpleLight.position.set(0, 15, 0);
    this.scene.add(purpleLight);
  }

  createGround() {
    // Main ground
    const groundGeometry = new THREE.PlaneGeometry(200, 200, 50, 50);
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x1e1e2e,
      roughness: 0.9,
      metalness: 0.1
    });
    
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Grid pattern
    const gridHelper = new THREE.GridHelper(200, 40, 0x2d2d44, 0x252538);
    this.scene.add(gridHelper);

    // Circular plaza
    const plazaGeometry = new THREE.CircleGeometry(20, 32);
    const plazaMaterial = new THREE.MeshStandardMaterial({
      color: 0x2a2a3a,
      roughness: 0.7
    });
    const plaza = new THREE.Mesh(plazaGeometry, plazaMaterial);
    plaza.rotation.x = -Math.PI / 2;
    plaza.position.y = 0.01;
    plaza.receiveShadow = true;
    this.scene.add(plaza);

    // Plaza ring
    const ringGeometry = new THREE.RingGeometry(18, 20, 32);
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0xff6b9d,
      side: THREE.DoubleSide
    });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.02;
    this.scene.add(ring);
  }

  createPlayer() {
    // Player body (simple box character)
    const playerGroup = new THREE.Group();
    
    // Body
    const bodyGeometry = new THREE.BoxGeometry(1, 1.5, 0.5);
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x4a90d9 });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 1;
    body.castShadow = true;
    playerGroup.add(body);

    // Head
    const headGeometry = new THREE.BoxGeometry(0.8, 0.8, 0.8);
    const headMaterial = new THREE.MeshStandardMaterial({ color: 0xffd8b5 });
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.position.y = 2.2;
    head.castShadow = true;
    playerGroup.add(head);

    // Hair
    const hairGeometry = new THREE.BoxGeometry(0.9, 0.4, 0.9);
    const hairMaterial = new THREE.MeshStandardMaterial({ color: 0x3d2314 });
    const hair = new THREE.Mesh(hairGeometry, hairMaterial);
    hair.position.y = 2.7;
    hair.castShadow = true;
    playerGroup.add(hair);

    // Eyes
    const eyeGeometry = new THREE.BoxGeometry(0.15, 0.15, 0.1);
    const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    leftEye.position.set(-0.2, 2.3, 0.4);
    playerGroup.add(leftEye);
    
    const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    rightEye.position.set(0.2, 2.3, 0.4);
    playerGroup.add(rightEye);

    this.player = playerGroup;
    this.player.position.set(0, 0, 0);
    this.scene.add(this.player);
  }

  createInstagramWorld() {
    // Central Instagram Hub
    this.createBuilding({
      position: new THREE.Vector3(0, 0, -15),
      size: { width: 8, height: 12, depth: 8 },
      color: 0xe4405f,
      accentColor: 0xffffff,
      name: 'Instagram Hub',
      type: 'hub',
      icon: '📱'
    });

    // Stories Building (circular tower)
    this.createCircularBuilding({
      position: new THREE.Vector3(-18, 0, -5),
      radius: 5,
      height: 10,
      color: 0xff6b9d,
      name: 'Stories Tower',
      type: 'stories',
      icon: '📖'
    });

    // Messages Building
    this.createBuilding({
      position: new THREE.Vector3(18, 0, -5),
      size: { width: 7, height: 8, depth: 6 },
      color: 0x61dafb,
      accentColor: 0x0095f6,
      name: 'Message Center',
      type: 'messages',
      icon: '💬'
    });

    // Posts Gallery
    this.createBuilding({
      position: new THREE.Vector3(-12, 0, 15),
      size: { width: 10, height: 6, depth: 8 },
      color: 0xc678dd,
      accentColor: 0x9b59b6,
      name: 'Post Gallery',
      type: 'posts',
      icon: '🖼️'
    });

    // Explore Zone
    this.createBuilding({
      position: new THREE.Vector3(12, 0, 15),
      size: { width: 8, height: 7, depth: 7 },
      color: 0xffd93d,
      accentColor: 0xf39c12,
      name: 'Explore Zone',
      type: 'explore',
      icon: '🔍'
    });

    // Decorative elements
    this.createDecorations();
    
    // NPCs
    this.createNPCs();
  }

  createBuilding(config) {
    const { position, size, color, accentColor, name, type, icon } = config;
    const buildingGroup = new THREE.Group();

    // Main structure
    const mainGeometry = new THREE.BoxGeometry(size.width, size.height, size.depth);
    const mainMaterial = new THREE.MeshStandardMaterial({
      color: color,
      roughness: 0.6,
      metalness: 0.2
    });
    const main = new THREE.Mesh(mainGeometry, mainMaterial);
    main.position.y = size.height / 2;
    main.castShadow = true;
    main.receiveShadow = true;
    buildingGroup.add(main);

    // Roof
    const roofGeometry = new THREE.BoxGeometry(size.width + 0.5, 0.5, size.depth + 0.5);
    const roofMaterial = new THREE.MeshStandardMaterial({
      color: accentColor || color,
      roughness: 0.4
    });
    const roof = new THREE.Mesh(roofGeometry, roofMaterial);
    roof.position.y = size.height + 0.25;
    roof.castShadow = true;
    buildingGroup.add(roof);

    // Windows (emissive)
    const windowGeometry = new THREE.BoxGeometry(1, 1.5, 0.1);
    const windowMaterial = new THREE.MeshBasicMaterial({ 
      color: 0xffffff,
      transparent: true,
      opacity: 0.8
    });
    
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < Math.floor(size.height / 3); j++) {
        const window = new THREE.Mesh(windowGeometry, windowMaterial);
        window.position.set(
          (i - 1) * 2,
          j * 3 + 2,
          size.depth / 2 + 0.05
        );
        buildingGroup.add(window);
      }
    }

    // Door
    const doorGeometry = new THREE.BoxGeometry(2, 3, 0.1);
    const doorMaterial = new THREE.MeshStandardMaterial({
      color: 0x2d2d44,
      emissive: 0x333344,
      emissiveIntensity: 0.3
    });
    const door = new THREE.Mesh(doorGeometry, doorMaterial);
    door.position.set(0, 1.5, size.depth / 2 + 0.05);
    buildingGroup.add(door);

    // Sign above door
    const signGeometry = new THREE.BoxGeometry(4, 1, 0.2);
    const signMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const sign = new THREE.Mesh(signGeometry, signMaterial);
    sign.position.set(0, 4, size.depth / 2 + 0.1);
    buildingGroup.add(sign);

    // Glow effect
    const glowGeometry = new THREE.SphereGeometry(size.width / 2, 16, 16);
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.1
    });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    glow.position.y = size.height / 2;
    glow.scale.set(1.5, 1.5, 1.5);
    buildingGroup.add(glow);

    buildingGroup.position.copy(position);
    buildingGroup.userData = { name, type, icon, interactable: true };
    
    this.buildings.push(buildingGroup);
    this.interactables.push(buildingGroup);
    this.scene.add(buildingGroup);
  }

  createCircularBuilding(config) {
    const { position, radius, height, color, name, type, icon } = config;
    const buildingGroup = new THREE.Group();

    // Main cylinder
    const mainGeometry = new THREE.CylinderGeometry(radius, radius, height, 32);
    const mainMaterial = new THREE.MeshStandardMaterial({
      color: color,
      roughness: 0.5,
      metalness: 0.3
    });
    const main = new THREE.Mesh(mainGeometry, mainMaterial);
    main.position.y = height / 2;
    main.castShadow = true;
    main.receiveShadow = true;
    buildingGroup.add(main);

    // Top ring (Instagram story style)
    const ringGeometry = new THREE.TorusGeometry(radius + 0.5, 0.3, 16, 32);
    const ringMaterial = new THREE.MeshBasicMaterial({ 
      color: 0xffffff 
    });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = height + 0.3;
    buildingGroup.add(ring);

    // Gradient ring effect
    const gradientRingGeometry = new THREE.TorusGeometry(radius + 0.3, 0.4, 16, 32);
    const gradientRingMaterial = new THREE.MeshBasicMaterial({
      color: 0xffc107,
      transparent: true,
      opacity: 0.7
    });
    const gradientRing = new THREE.Mesh(gradientRingGeometry, gradientRingMaterial);
    gradientRing.rotation.x = Math.PI / 2;
    gradientRing.position.y = height + 0.5;
    buildingGroup.add(gradientRing);

    // Door
    const doorGeometry = new THREE.BoxGeometry(2, 3, 0.5);
    const doorMaterial = new THREE.MeshStandardMaterial({
      color: 0x2d2d44,
      emissive: 0x222233,
      emissiveIntensity: 0.3
    });
    const door = new THREE.Mesh(doorGeometry, doorMaterial);
    door.position.set(0, 1.5, radius);
    buildingGroup.add(door);

    buildingGroup.position.copy(position);
    buildingGroup.userData = { name, type, icon, interactable: true };
    
    this.buildings.push(buildingGroup);
    this.interactables.push(buildingGroup);
    this.scene.add(buildingGroup);
  }

  createDecorations() {
    // Trees
    for (let i = 0; i < 20; i++) {
      const angle = (i / 20) * Math.PI * 2;
      const distance = 35 + Math.random() * 20;
      this.createTree(
        Math.cos(angle) * distance,
        Math.sin(angle) * distance
      );
    }

    // Lamp posts
    const lampPositions = [
      { x: -8, z: 0 }, { x: 8, z: 0 },
      { x: 0, z: 8 }, { x: 0, z: -8 },
      { x: -6, z: -6 }, { x: 6, z: -6 },
      { x: -6, z: 6 }, { x: 6, z: 6 }
    ];
    
    lampPositions.forEach(pos => this.createLampPost(pos.x, pos.z));

    // Flower beds
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const x = Math.cos(angle) * 25;
      const z = Math.sin(angle) * 25;
      this.createFlowerBed(x, z);
    }

    // Benches
    this.createBench(10, 5);
    this.createBench(-10, 5);
    this.createBench(10, -10);
    this.createBench(-10, -10);
  }

  createTree(x, z) {
    const treeGroup = new THREE.Group();

    // Trunk
    const trunkGeometry = new THREE.CylinderGeometry(0.3, 0.4, 3, 8);
    const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x4a3728 });
    const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
    trunk.position.y = 1.5;
    trunk.castShadow = true;
    treeGroup.add(trunk);

    // Foliage (pixel-like layers)
    const foliageColors = [0x2ecc71, 0x27ae60, 0x1abc9c];
    for (let i = 0; i < 3; i++) {
      const size = 3 - i * 0.5;
      const foliageGeometry = new THREE.BoxGeometry(size, 1.5, size);
      const foliageMaterial = new THREE.MeshStandardMaterial({ 
        color: foliageColors[i]
      });
      const foliage = new THREE.Mesh(foliageGeometry, foliageMaterial);
      foliage.position.y = 3.5 + i * 1.2;
      foliage.castShadow = true;
      treeGroup.add(foliage);
    }

    treeGroup.position.set(x, 0, z);
    this.decorations.push(treeGroup);
    this.scene.add(treeGroup);
  }

  createLampPost(x, z) {
    const lampGroup = new THREE.Group();

    // Pole
    const poleGeometry = new THREE.CylinderGeometry(0.1, 0.1, 5, 8);
    const poleMaterial = new THREE.MeshStandardMaterial({ color: 0x333333 });
    const pole = new THREE.Mesh(poleGeometry, poleMaterial);
    pole.position.y = 2.5;
    pole.castShadow = true;
    lampGroup.add(pole);

    // Lamp head
    const lampGeometry = new THREE.BoxGeometry(0.8, 0.5, 0.8);
    const lampMaterial = new THREE.MeshBasicMaterial({ 
      color: 0xffd93d,
      transparent: true,
      opacity: 0.9
    });
    const lamp = new THREE.Mesh(lampGeometry, lampMaterial);
    lamp.position.y = 5.25;
    lampGroup.add(lamp);

    // Point light
    const light = new THREE.PointLight(0xffd93d, 0.5, 15);
    light.position.y = 5;
    lampGroup.add(light);

    lampGroup.position.set(x, 0, z);
    this.decorations.push(lampGroup);
    this.scene.add(lampGroup);
  }

  createFlowerBed(x, z) {
    const bedGroup = new THREE.Group();

    // Base
    const baseGeometry = new THREE.CylinderGeometry(2, 2, 0.5, 16);
    const baseMaterial = new THREE.MeshStandardMaterial({ color: 0x5d4e37 });
    const base = new THREE.Mesh(baseGeometry, baseMaterial);
    base.position.y = 0.25;
    bedGroup.add(base);

    // Flowers
    const flowerColors = [0xff6b9d, 0xc678dd, 0x61dafb, 0xffd93d, 0xe06c75];
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const r = 1 + Math.random() * 0.5;
      const flowerGeometry = new THREE.SphereGeometry(0.2, 8, 8);
      const flowerMaterial = new THREE.MeshBasicMaterial({
        color: flowerColors[Math.floor(Math.random() * flowerColors.length)]
      });
      const flower = new THREE.Mesh(flowerGeometry, flowerMaterial);
      flower.position.set(
        Math.cos(angle) * r,
        0.7 + Math.random() * 0.3,
        Math.sin(angle) * r
      );
      bedGroup.add(flower);
    }

    bedGroup.position.set(x, 0, z);
    this.decorations.push(bedGroup);
    this.scene.add(bedGroup);
  }

  createBench(x, z) {
    const benchGroup = new THREE.Group();

    // Seat
    const seatGeometry = new THREE.BoxGeometry(3, 0.2, 0.8);
    const seatMaterial = new THREE.MeshStandardMaterial({ color: 0x6b4423 });
    const seat = new THREE.Mesh(seatGeometry, seatMaterial);
    seat.position.y = 0.7;
    seat.castShadow = true;
    benchGroup.add(seat);

    // Back
    const backGeometry = new THREE.BoxGeometry(3, 0.8, 0.1);
    const back = new THREE.Mesh(backGeometry, seatMaterial);
    back.position.set(0, 1.2, -0.35);
    back.castShadow = true;
    benchGroup.add(back);

    // Legs
    const legGeometry = new THREE.BoxGeometry(0.2, 0.7, 0.6);
    const legMaterial = new THREE.MeshStandardMaterial({ color: 0x333333 });
    
    const leg1 = new THREE.Mesh(legGeometry, legMaterial);
    leg1.position.set(-1.2, 0.35, 0);
    benchGroup.add(leg1);
    
    const leg2 = new THREE.Mesh(legGeometry, legMaterial);
    leg2.position.set(1.2, 0.35, 0);
    benchGroup.add(leg2);

    benchGroup.position.set(x, 0, z);
    benchGroup.rotation.y = Math.atan2(-z, -x);
    this.decorations.push(benchGroup);
    this.scene.add(benchGroup);
  }

  createFountain(x, z) {
    const fountainGroup = new THREE.Group();

    // Base pool
    const poolGeometry = new THREE.CylinderGeometry(3, 3.5, 0.8, 24);
    const poolMaterial = new THREE.MeshStandardMaterial({ color: 0x4a5568 });
    const pool = new THREE.Mesh(poolGeometry, poolMaterial);
    pool.position.y = 0.4;
    pool.castShadow = true;
    fountainGroup.add(pool);

    // Water surface
    const waterGeometry = new THREE.CylinderGeometry(2.8, 2.8, 0.1, 24);
    const waterMaterial = new THREE.MeshBasicMaterial({ 
      color: 0x61dafb, 
      transparent: true, 
      opacity: 0.6 
    });
    const water = new THREE.Mesh(waterGeometry, waterMaterial);
    water.position.y = 0.7;
    fountainGroup.add(water);

    // Center column
    const columnGeometry = new THREE.CylinderGeometry(0.4, 0.5, 2, 12);
    const columnMaterial = new THREE.MeshStandardMaterial({ color: 0x718096 });
    const column = new THREE.Mesh(columnGeometry, columnMaterial);
    column.position.y = 1.5;
    column.castShadow = true;
    fountainGroup.add(column);

    // Top bowl
    const bowlGeometry = new THREE.CylinderGeometry(1.2, 0.8, 0.4, 16);
    const bowl = new THREE.Mesh(bowlGeometry, poolMaterial);
    bowl.position.y = 2.7;
    fountainGroup.add(bowl);

    // Water spray particles (simulated with small spheres)
    for (let i = 0; i < 5; i++) {
      const dropGeometry = new THREE.SphereGeometry(0.1, 8, 8);
      const dropMaterial = new THREE.MeshBasicMaterial({ 
        color: 0x61dafb, 
        transparent: true, 
        opacity: 0.7 
      });
      const drop = new THREE.Mesh(dropGeometry, dropMaterial);
      const angle = (i / 5) * Math.PI * 2;
      drop.position.set(
        Math.cos(angle) * 0.5,
        3 + Math.random() * 0.5,
        Math.sin(angle) * 0.5
      );
      fountainGroup.add(drop);
    }

    fountainGroup.position.set(x, 0, z);
    this.decorations.push(fountainGroup);
    this.scene.add(fountainGroup);
  }

  createSmallBuilding(x, z) {
    const buildingGroup = new THREE.Group();
    
    // Random building color
    const colors = [0x9b59b6, 0x3498db, 0xe74c3c, 0xf39c12, 0x1abc9c];
    const color = colors[Math.floor(Math.random() * colors.length)];
    
    // Main structure
    const width = 4 + Math.random() * 2;
    const height = 6 + Math.random() * 4;
    const depth = 4 + Math.random() * 2;
    
    const mainGeometry = new THREE.BoxGeometry(width, height, depth);
    const mainMaterial = new THREE.MeshStandardMaterial({ 
      color: color,
      roughness: 0.7,
      metalness: 0.1
    });
    const main = new THREE.Mesh(mainGeometry, mainMaterial);
    main.position.y = height / 2;
    main.castShadow = true;
    main.receiveShadow = true;
    buildingGroup.add(main);

    // Windows
    const windowMaterial = new THREE.MeshBasicMaterial({ 
      color: 0xffd93d, 
      transparent: true, 
      opacity: 0.8 
    });
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 2; col++) {
        const windowGeometry = new THREE.BoxGeometry(0.6, 0.8, 0.1);
        const window = new THREE.Mesh(windowGeometry, windowMaterial);
        window.position.set(
          (col - 0.5) * 1.5,
          2 + row * 2,
          depth / 2 + 0.05
        );
        buildingGroup.add(window);
      }
    }

    // Roof
    const roofGeometry = new THREE.BoxGeometry(width + 0.5, 0.5, depth + 0.5);
    const roofMaterial = new THREE.MeshStandardMaterial({ color: 0x2d3436 });
    const roof = new THREE.Mesh(roofGeometry, roofMaterial);
    roof.position.y = height + 0.25;
    buildingGroup.add(roof);

    buildingGroup.position.set(x, 0, z);
    buildingGroup.rotation.y = Math.random() * Math.PI * 2;
    this.decorations.push(buildingGroup);
    this.scene.add(buildingGroup);
  }

  // Create a placed item by type
  createPlacedItem(type, x, z) {
    console.log(`Creating placed item: ${type} at (${x}, ${z})`);
    
    switch (type) {
      case 'tree':
        this.createTree(x, z);
        break;
      case 'building':
        this.createSmallBuilding(x, z);
        break;
      case 'fountain':
        this.createFountain(x, z);
        break;
      case 'bench':
        this.createBench(x, z);
        break;
      case 'lamp':
        this.createLampPost(x, z);
        break;
      case 'flowers':
        this.createFlowerBed(x, z);
        break;
      default:
        console.warn(`Unknown item type: ${type}`);
    }
  }

  createNPCs() {
    const npcConfigs = [
      { position: new THREE.Vector3(5, 0, 5), color: 0xff9ff3, name: 'Story Keeper' },
      { position: new THREE.Vector3(-5, 0, 5), color: 0x54a0ff, name: 'Message Carrier' },
      { position: new THREE.Vector3(0, 0, 10), color: 0x5f27cd, name: 'Post Master' }
    ];

    npcConfigs.forEach(config => this.createNPC(config));
  }

  // Populate world with Instagram friends from scraped data
  populateWithFriends(data) {
    console.log('Populating world with friends:', data);
    
    const colors = [0xff6b9d, 0x61dafb, 0xc678dd, 0x98c379, 0xe5c07b, 0xff9ff3, 0x54a0ff, 0x5f27cd];
    let friendIndex = 0;
    
    // Track created usernames to avoid duplicates
    const createdUsers = new Set();
    
    // Random offset helper
    const randOffset = (range) => (Math.random() - 0.5) * range;
    
    // Seeded random for consistent positions per username
    const seededRandom = (seed) => {
      let hash = 0;
      for (let i = 0; i < seed.length; i++) {
        hash = ((hash << 5) - hash) + seed.charCodeAt(i);
        hash = hash & hash;
      }
      return (Math.abs(hash) % 1000) / 1000;
    };
    
    // Add story friends scattered around the Stories building (left side)
    if (data.stories && data.stories.length > 0) {
      data.stories.forEach((story, i) => {
        if (createdUsers.has(story.username)) return;
        createdUsers.add(story.username);
        
        const seed = story.username || `story${i}`;
        const r1 = seededRandom(seed);
        const r2 = seededRandom(seed + 'z');
        
        // Scatter randomly across the left half of the world
        const x = -60 + r1 * 50 + randOffset(10);
        const z = -40 + r2 * 80 + randOffset(10);
        
        this.createNPC({
          position: new THREE.Vector3(x, 0, z),
          color: colors[friendIndex % colors.length],
          name: story.username || `Friend ${i + 1}`,
          type: 'story',
          data: story
        });
        friendIndex++;
      });
    }
    
    // Add message contacts scattered around the Messages building (right side)
    if (data.messages && data.messages.length > 0) {
      data.messages.forEach((msg, i) => {
        const username = msg.name || msg.username;
        if (createdUsers.has(username)) return;
        createdUsers.add(username);
        
        const seed = username || `msg${i}`;
        const r1 = seededRandom(seed);
        const r2 = seededRandom(seed + 'z');
        
        // Scatter randomly across the right half of the world
        const x = 10 + r1 * 50 + randOffset(10);
        const z = -40 + r2 * 80 + randOffset(10);
        
        this.createNPC({
          position: new THREE.Vector3(x, 0, z),
          color: colors[friendIndex % colors.length],
          name: username || `Chat ${i + 1}`,
          type: 'message',
          data: msg
        });
        friendIndex++;
      });
    }
    
    // Add suggestions scattered in the back area
    if (data.suggestions && data.suggestions.length > 0) {
      data.suggestions.forEach((sug, i) => {
        if (createdUsers.has(sug.username)) return;
        createdUsers.add(sug.username);
        
        const seed = sug.username || `sug${i}`;
        const r1 = seededRandom(seed);
        const r2 = seededRandom(seed + 'z');
        
        // Scatter across the entire back area
        const x = -50 + r1 * 100 + randOffset(10);
        const z = -60 + r2 * 30 + randOffset(10);
        
        this.createNPC({
          position: new THREE.Vector3(x, 0, z),
          color: 0x56b6c2,
          name: sug.username || `Suggested ${i + 1}`,
          type: 'suggestion',
          data: sug
        });
        friendIndex++;
      });
    }
    
    // Add mutuals scattered in the center plaza
    if (data.mutuals && data.mutuals.length > 0) {
      data.mutuals.forEach((mut, i) => {
        if (createdUsers.has(mut.username)) return;
        createdUsers.add(mut.username);
        
        const seed = mut.username || `mut${i}`;
        const r1 = seededRandom(seed);
        const r2 = seededRandom(seed + 'z');
        
        // Scatter everywhere for mutuals
        const x = -40 + r1 * 80 + randOffset(10);
        const z = -30 + r2 * 60 + randOffset(10);
        
        this.createNPC({
          position: new THREE.Vector3(x, 0, z),
          color: 0xff6b9d,
          name: mut.username || `Mutual ${i + 1}`,
          type: 'mutual',
          data: mut
        });
        friendIndex++;
      });
    }
    
    console.log(`Created ${friendIndex} friend NPCs (${createdUsers.size} unique users)`);
  }

  createNPC(config) {
    const { position, color, name, type = 'npc', data = null } = config;
    const npcGroup = new THREE.Group();

    // Body
    const bodyGeometry = new THREE.BoxGeometry(0.8, 1.2, 0.4);
    const bodyMaterial = new THREE.MeshStandardMaterial({ color });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 0.9;
    body.castShadow = true;
    npcGroup.add(body);

    // Head
    const headGeometry = new THREE.BoxGeometry(0.6, 0.6, 0.6);
    const headMaterial = new THREE.MeshStandardMaterial({ color: 0xffd8b5 });
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.position.y = 1.9;
    head.castShadow = true;
    npcGroup.add(head);

    // Eyes
    const eyeGeometry = new THREE.BoxGeometry(0.1, 0.1, 0.1);
    const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    leftEye.position.set(-0.15, 2, 0.3);
    npcGroup.add(leftEye);
    
    const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    rightEye.position.set(0.15, 2, 0.3);
    npcGroup.add(rightEye);

    // Profile picture frame (circular) - always visible above head
    const profileGroup = new THREE.Group();
    profileGroup.name = 'profilePic';
    profileGroup.visible = true; // Always visible
    
    // Instagram-style gradient ring
    const ringGeometry = new THREE.RingGeometry(0.55, 0.7, 32);
    const ringMaterial = new THREE.MeshBasicMaterial({ 
      color: 0xff6b9d,
      side: THREE.DoubleSide
    });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    profileGroup.add(ring);
    
    // Profile picture placeholder (will be replaced with texture if available)
    const picGeometry = new THREE.CircleGeometry(0.5, 32);
    let picMaterial;
    
    // Try to load profile image if available
    const imageUrl = data?.imgSrc || data?.profilePic || data?.image;
    console.log('Loading profile pic for', name, ':', imageUrl ? imageUrl.substring(0, 50) + '...' : 'none');
    
    if (imageUrl && imageUrl.startsWith('http')) {
      const textureLoader = new THREE.TextureLoader();
      textureLoader.crossOrigin = 'anonymous';
      textureLoader.load(
        imageUrl,
        (texture) => {
          console.log('Successfully loaded profile pic for', name);
          const loadedMaterial = new THREE.MeshBasicMaterial({ 
            map: texture,
            side: THREE.DoubleSide
          });
          pic.material = loadedMaterial;
        },
        undefined,
        (error) => {
          // On error, keep the initial canvas
          console.log('Failed to load profile pic for', name, '- using initial');
        }
      );
    }
    
    // Create a canvas with the user's initial
    const picCanvas = document.createElement('canvas');
    picCanvas.width = 128;
    picCanvas.height = 128;
    const picCtx = picCanvas.getContext('2d');
    
    // Draw colored circle background
    const colorHex = '#' + color.toString(16).padStart(6, '0');
    picCtx.fillStyle = colorHex;
    picCtx.beginPath();
    picCtx.arc(64, 64, 64, 0, Math.PI * 2);
    picCtx.fill();
    
    // Draw initial letter
    const initial = (name || '?').charAt(0).toUpperCase();
    picCtx.fillStyle = '#ffffff';
    picCtx.font = 'bold 72px Arial';
    picCtx.textAlign = 'center';
    picCtx.textBaseline = 'middle';
    picCtx.fillText(initial, 64, 68);
    
    const picTexture = new THREE.CanvasTexture(picCanvas);
    picMaterial = new THREE.MeshBasicMaterial({ 
      map: picTexture,
      side: THREE.DoubleSide
    });
    const pic = new THREE.Mesh(picGeometry, picMaterial);
    pic.name = 'profileImage';
    profileGroup.add(pic);
    
    // Username label (using sprite)
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.roundRect(0, 0, 256, 64, 10);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(name.substring(0, 20), 128, 40);
    
    const labelTexture = new THREE.CanvasTexture(canvas);
    const labelMaterial = new THREE.SpriteMaterial({ map: labelTexture });
    const label = new THREE.Sprite(labelMaterial);
    label.scale.set(2, 0.5, 1);
    label.position.y = -0.9;
    profileGroup.add(label);
    
    profileGroup.position.y = 3.2;
    npcGroup.add(profileGroup);

    // Small indicator dot (always visible)
    const dotGeometry = new THREE.SphereGeometry(0.15, 8, 8);
    const dotMaterial = new THREE.MeshBasicMaterial({ color: 0x61dafb });
    const dot = new THREE.Mesh(dotGeometry, dotMaterial);
    dot.position.y = 2.6;
    dot.name = 'indicator';
    npcGroup.add(dot);

    npcGroup.position.copy(position);
    
    // Walking behavior data
    const walkData = {
      isWalking: Math.random() > 0.5, // Start randomly walking or paused
      walkDirection: new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize(),
      walkSpeed: 0.5 + Math.random() * 0.5, // Random speed between 0.5 and 1
      stateTimer: Math.random() * 30000, // Random start time
      walkDuration: 5000, // 5 seconds walking
      pauseDuration: 30000, // 30 seconds pausing
      originalPosition: position.clone(),
      maxWanderDistance: 15 + Math.random() * 10 // How far they can wander
    };
    
    npcGroup.userData = { name, type, data, interactable: true, walkData };
    
    this.npcs.push(npcGroup);
    this.interactables.push(npcGroup);
    this.scene.add(npcGroup);
  }

  createParticles() {
    // Floating particles for ambient effect
    const particleCount = 100;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    const particleColors = [
      new THREE.Color(0xff6b9d),
      new THREE.Color(0xc678dd),
      new THREE.Color(0x61dafb),
      new THREE.Color(0xffd93d)
    ];

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 100;
      positions[i * 3 + 1] = Math.random() * 30;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 100;

      const color = particleColors[Math.floor(Math.random() * particleColors.length)];
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.3,
      vertexColors: true,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending
    });

    this.particleSystem = new THREE.Points(geometry, material);
    this.scene.add(this.particleSystem);
  }

  // Movement methods
  setMovement(direction, value) {
    this.moveDirection[direction] = value;
  }

  updatePlayer(delta) {
    if (!this.player) return;

    const moveVector = new THREE.Vector3();

    if (this.moveDirection.forward) moveVector.z -= 1;
    if (this.moveDirection.backward) moveVector.z += 1;
    if (this.moveDirection.left) moveVector.x -= 1;
    if (this.moveDirection.right) moveVector.x += 1;

    if (moveVector.length() > 0) {
      moveVector.normalize();
      moveVector.multiplyScalar(this.playerSpeed);
      
      // Apply camera rotation to movement
      const cameraDirection = new THREE.Vector3();
      this.camera.getWorldDirection(cameraDirection);
      cameraDirection.y = 0;
      cameraDirection.normalize();
      
      const angle = Math.atan2(cameraDirection.x, cameraDirection.z);
      moveVector.applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
      
      this.player.position.add(moveVector);
      
      // Rotate player to face movement direction
      if (moveVector.x !== 0 || moveVector.z !== 0) {
        this.player.rotation.y = Math.atan2(moveVector.x, moveVector.z);
      }

      // Walking animation
      this.player.position.y = Math.sin(Date.now() * 0.01) * 0.1;
    }

    // Update camera to follow player
    const targetCameraPos = new THREE.Vector3(
      this.player.position.x + this.cameraOffset.x,
      this.cameraOffset.y,
      this.player.position.z + this.cameraOffset.z
    );
    this.camera.position.lerp(targetCameraPos, 0.1);
    this.camera.lookAt(this.player.position);

    // Check for nearby interactables
    this.checkInteractables();
  }

  checkInteractables() {
    let nearest = null;
    let nearestDist = Infinity;

    this.interactables.forEach(obj => {
      const dist = this.player.position.distanceTo(obj.position);
      if (dist < 5 && dist < nearestDist) {
        nearestDist = dist;
        nearest = obj;
      }
    });

    this.nearestInteractable = nearest;
    
    // Calculate distances and find 5 closest NPCs
    const npcDistances = this.npcs.map(npc => ({
      npc,
      distance: this.player.position.distanceTo(npc.position)
    }));
    npcDistances.sort((a, b) => a.distance - b.distance);
    const closestNPCs = new Set(npcDistances.slice(0, 5).map(d => d.npc));
    
    // Track closest NPC for interaction prompt (no auto-loading)
    const closestNPC = npcDistances.length > 0 ? npcDistances[0] : null;
    this.closestNPC = closestNPC && closestNPC.distance < 8 ? closestNPC.npc : null;
    
    // Update profile pics - only show for 5 closest
    this.npcs.forEach(npc => {
      const distance = this.player.position.distanceTo(npc.position);
      const indicator = npc.getObjectByName('indicator');
      const profilePic = npc.getObjectByName('profilePic');
      const isClose = closestNPCs.has(npc);
      
      if (profilePic) {
        // Only visible for 5 closest NPCs
        profilePic.visible = isClose;
        
        if (isClose) {
          profilePic.lookAt(this.camera.position);
          // Gentle floating animation
          profilePic.position.y = 3.2 + Math.sin(Date.now() * 0.003 + npc.position.x) * 0.1;
          
          // Scale based on distance - bigger when closer
          const scale = Math.max(0.8, 1.5 - distance * 0.05);
          profilePic.scale.setScalar(scale);
        }
      }
      
      if (indicator) {
        // Show pulsing indicator only for nearest interactable
        indicator.visible = npc === nearest && distance < 5;
        if (npc === nearest) {
          indicator.position.y = 2.6 + Math.sin(Date.now() * 0.008) * 0.15;
          // Pulse color
          const pulse = (Math.sin(Date.now() * 0.01) + 1) / 2;
          indicator.material.color.setHex(pulse > 0.5 ? 0x61dafb : 0xff6b9d);
        }
      }
    });

    return nearest;
  }

  getNearestInteractable() {
    return this.nearestInteractable;
  }

  // Animation loop
  animate() {
    requestAnimationFrame(() => this.animate());

    const delta = this.clock.getDelta();
    const elapsed = this.clock.getElapsedTime();
    
    // Debug: log once per second
    if (Math.floor(elapsed) !== this.lastLogTime) {
      this.lastLogTime = Math.floor(elapsed);
      console.log('Rendering... Scene objects:', this.scene.children.length, 'Camera pos:', this.camera.position);
    }

    // Update player
    this.updatePlayer(delta);

    // Animate particles
    if (this.particleSystem) {
      const positions = this.particleSystem.geometry.attributes.position.array;
      for (let i = 0; i < positions.length; i += 3) {
        positions[i + 1] += Math.sin(elapsed + i) * 0.01;
        if (positions[i + 1] > 30) positions[i + 1] = 0;
      }
      this.particleSystem.geometry.attributes.position.needsUpdate = true;
      this.particleSystem.rotation.y = elapsed * 0.05;
    }

    // Animate buildings
    this.buildings.forEach((building, i) => {
      const children = building.children;
      children.forEach(child => {
        if (child.material && child.material.emissive) {
          const intensity = 0.3 + Math.sin(elapsed * 2 + i) * 0.1;
          child.material.emissiveIntensity = intensity;
        }
      });
    });

    // Animate NPC walking
    this.updateNPCWalking(delta, elapsed);

    // Render
    this.renderer.render(this.scene, this.camera);
  }

  updateNPCWalking(delta, elapsed) {
    const now = Date.now();
    
    this.npcs.forEach(npc => {
      const wd = npc.userData.walkData;
      if (!wd) return;
      
      // Update state timer
      wd.stateTimer += delta * 1000;
      
      // Check if we need to switch states
      if (wd.isWalking && wd.stateTimer >= wd.walkDuration) {
        // Switch to pausing
        wd.isWalking = false;
        wd.stateTimer = 0;
        // Pick new random direction for next walk
        wd.walkDirection = new THREE.Vector3(
          Math.random() - 0.5, 
          0, 
          Math.random() - 0.5
        ).normalize();
      } else if (!wd.isWalking && wd.stateTimer >= wd.pauseDuration) {
        // Switch to walking
        wd.isWalking = true;
        wd.stateTimer = 0;
      }
      
      // If walking, move the NPC
      if (wd.isWalking) {
        const moveAmount = wd.walkSpeed * delta;
        
        // Calculate new position
        const newX = npc.position.x + wd.walkDirection.x * moveAmount;
        const newZ = npc.position.z + wd.walkDirection.z * moveAmount;
        
        // Check if still within wander distance from original position
        const distFromOrigin = Math.sqrt(
          Math.pow(newX - wd.originalPosition.x, 2) + 
          Math.pow(newZ - wd.originalPosition.z, 2)
        );
        
        if (distFromOrigin < wd.maxWanderDistance) {
          npc.position.x = newX;
          npc.position.z = newZ;
        } else {
          // Turn around - head back towards origin
          wd.walkDirection = new THREE.Vector3(
            wd.originalPosition.x - npc.position.x,
            0,
            wd.originalPosition.z - npc.position.z
          ).normalize();
        }
        
        // Rotate NPC to face walking direction
        const targetRotation = Math.atan2(wd.walkDirection.x, wd.walkDirection.z);
        npc.rotation.y = THREE.MathUtils.lerp(npc.rotation.y, targetRotation, 0.1);
        
        // Bobbing animation while walking
        npc.position.y = Math.abs(Math.sin(elapsed * 8)) * 0.1;
      } else {
        // Reset Y position when paused
        npc.position.y = 0;
        
        // Idle animation - slight sway
        npc.rotation.y += Math.sin(elapsed + npc.position.x) * 0.001;
      }
    });
  }

  onResize() {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    
    console.log('Resizing to:', width, 'x', height);
    
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  // Minimap rendering
  renderMinimap(canvas) {
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const scale = 2;

    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, width, height);

    // Draw grid
    ctx.strokeStyle = '#1e1e2e';
    ctx.lineWidth = 1;
    for (let i = 0; i <= width; i += 10) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, height);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(width, i);
      ctx.stroke();
    }

    // Draw buildings
    ctx.fillStyle = '#ff6b9d';
    this.buildings.forEach(building => {
      const x = (building.position.x / scale) + width / 2;
      const z = (building.position.z / scale) + height / 2;
      ctx.beginPath();
      ctx.arc(x, z, 5, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw player
    if (this.player) {
      const px = (this.player.position.x / scale) + width / 2;
      const pz = (this.player.position.z / scale) + height / 2;
      
      ctx.fillStyle = '#61dafb';
      ctx.beginPath();
      ctx.arc(px, pz, 4, 0, Math.PI * 2);
      ctx.fill();

      // Direction indicator
      ctx.strokeStyle = '#61dafb';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(px, pz);
      ctx.lineTo(
        px - Math.sin(this.player.rotation.y) * 8,
        pz - Math.cos(this.player.rotation.y) * 8
      );
      ctx.stroke();
    }
  }
}

window.GameRenderer = GameRenderer;


