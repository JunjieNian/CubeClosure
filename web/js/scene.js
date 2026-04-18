/**
 * scene.js — Three.js 3D scene: rooms, grid, camera, lighting
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Room color palette — curated distinct colors
const ROOM_PALETTE = [
  0xff4466, 0x00ff88, 0x00ccff, 0xffcc00, 0xff7744,
  0xaa44ff, 0x44ffaa, 0xff44aa, 0x4488ff, 0xff8844,
  0x44ffff, 0xffff44, 0x8844ff, 0x44ff44, 0xff4444,
  0x4444ff, 0xff44ff, 0x88ff44, 0x44aaff, 0xffaa44,
  0xaa88ff, 0x88ffaa, 0xff88aa, 0xaaff44, 0x44ffdd,
  0xdd44ff, 0xff6622,
];

export class CubeScene {
  constructor(container) {
    this.container = container;
    this.n = 8;
    this.roomSize = 0.55;
    this.roomGap = 1.0;
    this.rooms = [];
    this.roomMeshes = [];
    this.selectedRoom = -1;
    this.featuredRoom = 0;
    this.showAllRooms = false;
    this.showServiceLayer = true;
    this.showTrails = true;
    this.trailLines = [];

    this._initScene();
    this._initLights();
    this._initControls();
    this._initRaycaster();
    this._buildGrid();
  }

  _initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0a0f);
    this.scene.fog = new THREE.FogExp2(0x0a0a0f, 0.012);

    const aspect = this.container.clientWidth / this.container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 200);
    this.camera.position.set(14, 12, 18);
    this.camera.lookAt(4, 4, 4);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.container.appendChild(this.renderer.domElement);

    window.addEventListener('resize', () => this._onResize());
  }

  _initLights() {
    const ambient = new THREE.AmbientLight(0x334455, 0.8);
    this.scene.add(ambient);

    const dir1 = new THREE.DirectionalLight(0xffffff, 1.0);
    dir1.position.set(10, 15, 10);
    this.scene.add(dir1);

    const dir2 = new THREE.DirectionalLight(0x4488cc, 0.4);
    dir2.position.set(-8, 5, -6);
    this.scene.add(dir2);

    // Subtle point light for accent
    const point = new THREE.PointLight(0x00ff88, 0.3, 30);
    point.position.set(4, 10, 4);
    this.scene.add(point);
  }

  _initControls() {
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 5;
    this.controls.maxDistance = 60;
    this.controls.target.set(4, 4, 4);
    this.controls.update();
  }

  _initRaycaster() {
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.container.addEventListener('click', (e) => this._onClick(e));
  }

  _buildGrid() {
    // Clear existing wireframes
    if (this.innerWireframe) this.scene.remove(this.innerWireframe);
    if (this.outerWireframe) this.scene.remove(this.outerWireframe);
    for (const label of (this._serviceLabels || [])) this.scene.remove(label);
    this._serviceLabels = [];

    const n = this.n;
    const min = 0.5;
    const max = n + 0.5;

    // Inner core wireframe
    this.innerWireframe = this._createWireframeBox(min, max, 0x00ccff, 0.3);
    this.scene.add(this.innerWireframe);

    // Service layer wireframe
    const sMax = n + 1.5;
    this.outerWireframe = this._createWireframeBox(min, sMax, 0x556677, 0.12);
    this.scene.add(this.outerWireframe);
    this.outerWireframe.visible = this.showServiceLayer;

    // Update camera target
    const center = (n + 1) / 2;
    this.controls.target.set(center, center, center);
    this.camera.position.set(center + n * 1.2, center + n * 0.8, center + n * 1.4);
    this.controls.update();
  }

  _createWireframeBox(min, max, color, opacity) {
    const geo = new THREE.BoxGeometry(max - min, max - min, max - min);
    const edges = new THREE.EdgesGeometry(geo);
    const mat = new THREE.LineBasicMaterial({ color, opacity, transparent: true });
    const wireframe = new THREE.LineSegments(edges, mat);
    const center = (min + max) / 2;
    wireframe.position.set(center, center, center);
    return wireframe;
  }

  /**
   * Initialize room meshes for tracked positions.
   * positions: array of [x,y,z], identities: initial positions for coloring
   */
  initRooms(positions, identities) {
    // Remove old meshes
    for (const m of this.roomMeshes) this.scene.remove(m);
    this.roomMeshes = [];
    this.rooms = [];

    const geo = new THREE.BoxGeometry(this.roomSize, this.roomSize, this.roomSize);

    for (let i = 0; i < positions.length; i++) {
      const colorIdx = i % ROOM_PALETTE.length;
      const mat = new THREE.MeshPhongMaterial({
        color: ROOM_PALETTE[colorIdx],
        transparent: true,
        opacity: 0.85,
        shininess: 60,
      });
      const mesh = new THREE.Mesh(geo, mat);
      const [x, y, z] = positions[i];
      mesh.position.set(x, y, z);
      mesh.userData = {
        roomIndex: i,
        identity: identities ? [...identities[i]] : [...positions[i]],
        colorIndex: colorIdx,
      };
      this.scene.add(mesh);
      this.roomMeshes.push(mesh);
      this.rooms.push({
        mesh,
        currentPos: [x, y, z],
        targetPos: [x, y, z],
        identity: identities ? [...identities[i]] : [...positions[i]],
      });
    }

    // Highlight featured room
    this._updateFeaturedRoom();
  }

  /** Update target positions for animation */
  setTargetPositions(positions) {
    for (let i = 0; i < this.rooms.length && i < positions.length; i++) {
      this.rooms[i].targetPos = [...positions[i]];
    }
  }

  /** Snap to target positions instantly */
  snapToPositions(positions) {
    for (let i = 0; i < this.rooms.length && i < positions.length; i++) {
      this.rooms[i].currentPos = [...positions[i]];
      this.rooms[i].targetPos = [...positions[i]];
      this.rooms[i].mesh.position.set(positions[i][0], positions[i][1], positions[i][2]);
    }
  }

  /** Interpolate room positions. Returns true if still animating. */
  lerpPositions(t) {
    let moving = false;
    for (const room of this.rooms) {
      const [cx, cy, cz] = room.currentPos;
      const [tx, ty, tz] = room.targetPos;
      const dx = tx - cx, dy = ty - cy, dz = tz - cz;
      if (Math.abs(dx) > 0.001 || Math.abs(dy) > 0.001 || Math.abs(dz) > 0.001) {
        moving = true;
        const nx = cx + dx * t;
        const ny = cy + dy * t;
        const nz = cz + dz * t;
        room.currentPos = [nx, ny, nz];
        room.mesh.position.set(nx, ny, nz);
      } else {
        room.currentPos = [...room.targetPos];
        room.mesh.position.set(tx, ty, tz);
      }
    }
    return moving;
  }

  /** Update grid size */
  setGridSize(n) {
    this.n = n;
    this._buildGrid();
  }

  /** Set service layer visibility */
  setServiceLayerVisible(visible) {
    this.showServiceLayer = visible;
    if (this.outerWireframe) this.outerWireframe.visible = visible;
  }

  /** Select a room by index */
  selectRoom(index) {
    // Deselect previous
    if (this.selectedRoom >= 0 && this.selectedRoom < this.roomMeshes.length) {
      const prev = this.roomMeshes[this.selectedRoom];
      const prevColor = ROOM_PALETTE[prev.userData.colorIndex];
      prev.material.emissive.setHex(0x000000);
      prev.scale.set(1, 1, 1);
    }
    this.selectedRoom = index;
    if (index >= 0 && index < this.roomMeshes.length) {
      const mesh = this.roomMeshes[index];
      mesh.material.emissive.setHex(0x224400);
      mesh.scale.set(1.2, 1.2, 1.2);
    }
  }

  /** Update featured room highlight */
  _updateFeaturedRoom() {
    if (this._featuredStar) {
      this.scene.remove(this._featuredStar);
      this._featuredStar = null;
    }
    if (this.featuredRoom >= 0 && this.featuredRoom < this.rooms.length) {
      // Create a glowing ring around featured room
      const geo = new THREE.RingGeometry(0.35, 0.45, 6);
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffcc00,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8,
      });
      this._featuredStar = new THREE.Mesh(geo, mat);
      this.scene.add(this._featuredStar);
    }
  }

  /** Update featured room star position */
  updateFeaturedStar() {
    if (this._featuredStar && this.featuredRoom >= 0 && this.featuredRoom < this.rooms.length) {
      const room = this.rooms[this.featuredRoom];
      this._featuredStar.position.copy(room.mesh.position);
      this._featuredStar.position.y += 0.5;
      this._featuredStar.lookAt(this.camera.position);
    }
  }

  /** Draw trail for featured room through all states */
  drawTrail(allPositions) {
    this.clearTrails();
    if (!this.showTrails || !allPositions || allPositions.length < 2) return;

    const points = allPositions.map(p => new THREE.Vector3(p[0], p[1], p[2]));
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({
      color: 0xffcc00,
      transparent: true,
      opacity: 0.6,
      linewidth: 2,
    });
    const line = new THREE.Line(geo, mat);
    this.scene.add(line);
    this.trailLines.push(line);

    // Add dots at each state position
    const dotGeo = new THREE.SphereGeometry(0.08, 8, 8);
    const dotMat = new THREE.MeshBasicMaterial({ color: 0xffcc00 });
    for (const p of points) {
      const dot = new THREE.Mesh(dotGeo, dotMat);
      dot.position.copy(p);
      this.scene.add(dot);
      this.trailLines.push(dot);
    }
  }

  clearTrails() {
    for (const obj of this.trailLines) this.scene.remove(obj);
    this.trailLines = [];
  }

  _onClick(event) {
    const rect = this.container.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.roomMeshes);
    if (intersects.length > 0) {
      const idx = intersects[0].object.userData.roomIndex;
      this.selectRoom(idx);
      if (this.onRoomSelect) this.onRoomSelect(idx);
    }
  }

  _onResize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  render() {
    this.controls.update();
    this.updateFeaturedStar();
    this.renderer.render(this.scene, this.camera);
  }
}
