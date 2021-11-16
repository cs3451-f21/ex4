import { MousePosition } from './common';
// abstract library
import { DrawingCommon } from './common';
import * as THREE from 'three'
import { Mesh } from 'three';

import Easing from './easing'

const ANIMX = -1.5
const ANIMSPEED = 3

class PickHelper {
    raycaster = new THREE.Raycaster()
    pickedObject: THREE.Object3D | undefined = undefined;
    pickedObjectSavedColor = 0;
  
    constructor() {
        this.raycaster = new THREE.Raycaster();
        this.pickedObject = undefined;
        this.pickedObjectSavedColor = 0;
      }

      clearPickedObject() {
          // restore the color if there is a picked object
          if (this.pickedObject) {
              ((this.pickedObject as Mesh).material as THREE.MeshStandardMaterial).emissive.setHex(this.pickedObjectSavedColor);
              this.pickedObject = undefined;
          }
      } 

      pick(mouse: MousePosition, scene: THREE.Scene, camera: THREE.PerspectiveCamera, time: number, canvas: HTMLCanvasElement) {
        var normalizedPosition = {
            x: (mouse.x / canvas.width * window.devicePixelRatio ) *  2 - 1,
            y: (mouse.y / canvas.height * window.devicePixelRatio ) * -2 + 1  // note we flip Y
        }

        this.clearPickedObject();
        console.log(mouse, normalizedPosition)
        // cast a ray through the frustum
        this.raycaster.setFromCamera(normalizedPosition, camera);
        // get the list of objects the ray intersected
        const intersectedObjects = this.raycaster.intersectObjects(scene.children, true);
        if (intersectedObjects.length) {
          console.log(intersectedObjects)
          // pick the first object. It's the closest one
          this.pickedObject = intersectedObjects[0].object;
          // save its color
          this.pickedObjectSavedColor = ((this.pickedObject as Mesh).material as THREE.MeshStandardMaterial).emissive.getHex();
          // set its emissive color to flashing red/yellow
          ((this.pickedObject as Mesh).material as THREE.MeshStandardMaterial).emissive.setHex((time * 8) % 2 > 1 ? 0xFFFF00 : 0xFF0000);
        }
      }
  }
  
// A class for our application state and functionality
class Drawing extends DrawingCommon {
    // some suggested properties you might use in your implementation
    mousePosition: MousePosition | null = null;
    clickStart: MousePosition | null = null;
    clearMouse: MousePosition = {x: -100000, y: -100000}

    pickHelper = new PickHelper();

    constructor (canv: HTMLElement) {
        super (canv)
        // @ts-ignore
        this.animatedMesh = this.scene.animatedMesh


        // set up mouse callbacks
        this.glCanvas.onmousedown = (ev: MouseEvent) => {
            // this method is called when a mouse button is pressed.
            var mousePosition = DrawingCommon.offset(ev);   
            this.clickStart = mousePosition        
            this.mousePosition = mousePosition
        }
        
        this.glCanvas.onmouseup = (ev: MouseEvent) => {
            // this method is called when a mouse button is released.
            const clickEnd = DrawingCommon.offset(ev);
        }
        
        this.glCanvas.onmousemove = (ev: MouseEvent) => {
            // this method is called when the mouse moves.   
            const mouse = DrawingCommon.offset(ev);
            this.mousePosition = mouse 
        }

        this.glCanvas.onmouseout = (ev: MouseEvent) => {
            // this method is called when the mouse moves.   
            this.mousePosition = null
        }

        this.glCanvas.onmouseleave = (ev: MouseEvent) => {
            // this method is called when the mouse moves.   
            this.mousePosition = null
        }

    }

    //@ts-ignore  because this is initialized in initializeScene, which is called from the 
    // superclass constructor
    animatedMesh: THREE.Mesh;

    /*
	Set up the scene during class construction
	*/
	initializeScene(){
        const objectRoot = new THREE.Group();

        var geometry: THREE.BufferGeometry = new THREE.CylinderGeometry( 0, 0.3, 1, 10, 1 );
        var material = new THREE.MeshStandardMaterial( { color: 0x00ffff, flatShading: true } );
        var mesh = new THREE.Mesh( geometry, material );

        mesh.position.set(0,0,1);
        objectRoot.add( mesh );

        geometry = new THREE.TorusKnotGeometry(0.2, 0.05, 40, 10);
        material = new THREE.MeshStandardMaterial( { color: 0xffff00, flatShading: false } );
        mesh = new THREE.Mesh( geometry, material );

        mesh.position.set(ANIMX,0,0);
        objectRoot.add( mesh );

        // @ts-ignore
        this.scene.animatedMesh = mesh

        this.scene.add( objectRoot );
    }

    animating = false   // first time in, we grab the time as a start time

    animSpeed = ANIMSPEED   // meters per second
    animDist = -2*ANIMX     // distance of our transition

    animLengthTime = 1000 * Math.abs(2*ANIMX) / ANIMSPEED   // time for the animation

    animStart = 0       // start and end time of this transition, based on speed and distance
    animEnd = 0

    animStartX = ANIMX  // start and end x position
    animEndX = -ANIMX
    
    quatStart1End2 = new THREE.Quaternion();
    quatEnd1 = new THREE.Quaternion();
    quatStart2 = new THREE.Quaternion();

    quatStart = new THREE.Quaternion();
    quatEnd = new THREE.Quaternion();

    y = new THREE.Vector3(0,1,0)

	/*
	Update the scene during requestAnimationFrame callback before rendering
	*/
	updateScene(time: DOMHighResTimeStamp){
        // set up the first time
        if (!this.animating) {
            this.quatStart1End2.setFromAxisAngle(this.y, 0)
            this.quatEnd1.setFromAxisAngle(this.y, Math.PI - 0.01)
            this.quatStart2.setFromAxisAngle(this.y, Math.PI + 0.01)

            this.quatStart.copy(this.quatStart1End2)
            this.quatEnd.copy(this.quatEnd1)
            this.animating = true
            this.animStart = time;
            this.animEnd = this.animStart + this.animLengthTime
        }

        // if we've exceeded the motion time, flip the direction, and
        // and set the motion time to be the next interval 
        if (time > this.animEnd) {
            this.animStart = this.animEnd;
            this.animEnd = this.animStart + this.animLengthTime
            this.animStartX *= -1
            this.animEndX *= -1
            this.animDist *= -1
            if (this.animDist < 0) {
                this.quatStart.copy(this.quatStart1End2)
                this.quatEnd.copy(this.quatEnd1)    
            } else {
                this.quatStart.copy(this.quatStart2)
                this.quatEnd.copy(this.quatStart1End2)    
            }
        }

        // t goes from 0..1 over the time interval
        var t = (time - this.animStart) / this.animLengthTime  

        // get the position along the line
        this.animatedMesh.position.x = this.animStartX + t * this.animDist

        this.animatedMesh.quaternion.slerpQuaternions(this.quatStart, this.quatEnd, t)

        if (this.mousePosition) {
            this.pickHelper.pick(this.mousePosition, this.scene, this.camera, time * 0.001, this.glCanvas);
        } else {
            this.pickHelper.clearPickedObject();
        }
    }
}

// a global variable for our state.  We implement the drawing as a class, and 
// will have one instance
var myDrawing: Drawing;

// main function that we call below.
// This is done to keep things together and keep the variables created self contained.
// It is a common pattern on the web, since otherwise the variables below woudl be in 
// the global name space.  Not a huge deal here, of course.

function exec() {
    // find our container
    var div = document.getElementById("drawing");

    if (!div) {
        console.warn("Your HTML page needs a DIV with id='drawing'")
        return;
    }

    // create a Drawing object
    myDrawing = new Drawing(div);
}

exec()