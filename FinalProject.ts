"use strict";
//it will be handy to have references to some of our WebGL related objects
let gl:WebGLRenderingContext;
let canvas:HTMLCanvasElement;
let program:WebGLProgram;
let bufferId:WebGLBuffer;

let umv:WebGLUniformLocation; // index of model_view in shader program
let uproj:WebGLUniformLocation; // index of projection in shader program

let vPosition:GLint; // remember where this shader attribute is
let vColor:GLint; // remember where the color shader attribute is
let vNormal:GLint; // remember where the normal shader attribute is
let vSpecularColor:GLint; // remember where the specular color attribute is
let vSpecularExponent:GLint; // remember where the specular exponent attribute is

let ambient_light:WebGLUniformLocation; // index of ambient_light in shader program

// create arrays for light uniforms
let NUM_LIGHTS:number;
// 0 = overhead light, 1 & 2 = car headlights, 3 & 4 = emergency lights
let lightPosition:WebGLUniformLocation[];
let lightColor:WebGLUniformLocation[];
let lightDirection:WebGLUniformLocation[];
let on_off:WebGLUniformLocation[];
let lightSwitches:boolean[];

let xoffset:number; // translation x
let zoffset:number; // translation z

let xrot:number // rotate around x-axis
let yrot:number // rotate around y-axis
let zrot:number // rotate around z-axis

let headRot:number; // rotation of the head

let heading:number; // car's orientation angle in radians

let zoom:number; // zoom of the camera
let dolly:number; // camera location in the z direction

let cameras:boolean[];// 0 - free roam camera, 1 - viewpoint camera, 2 - chase camera

let freeRoamFixed:boolean; // camera is looking at center of stage

let moveForward:boolean = false; // true when car is moving forward
let moveBackward:boolean = false; // true when car is moving backward

// vertex offsets for render function
let carverts:number;
let driververts:number;
let groundverts:number;
let buildingverts:number;
let wheelverts:number;
let headlightverts:number;
let emergencyboxverts:number;

// emergency light rotation
let boxSpin:number;

let updateInterval:number; // interval for frames per second

import {
    initShaders,
    vec4,
    mat4,
    flatten,
    perspective,
    translate,
    lookAt,
    rotateX,
    rotateY,
    scalem, rotateZ, rotate
} from './helperfunctions.js';


//We want some set up to happen immediately when the page loads
window.onload = function init() {

    //fetch reference to the canvas element we defined in the html file
    canvas = document.getElementById("gl-canvas") as HTMLCanvasElement;
    //grab the WebGL 2 context for that canvas.  This is what we'll use to do our drawing
    gl = canvas.getContext('webgl2') as WebGLRenderingContext;
    if (!gl) {
        alert("WebGL isn't available");
    }

    //Take the vertex and fragment shaders we provided and compile them into a shader program
    program = initShaders(gl, "vertex-shader", "fragment-shader");
    gl.useProgram(program); //and we want to use that program for our rendering

    // fetch matrix uniforms
    umv = gl.getUniformLocation(program, "model_view");
    uproj = gl.getUniformLocation(program, "projection");

    // fetch attributes
    vPosition = gl.getAttribLocation(program, "vPosition");
    vNormal = gl.getAttribLocation(program, "vNormal");
    vColor = gl.getAttribLocation(program, "vColor");
    vSpecularColor = gl.getAttribLocation(program, "vSpecularColor");
    vSpecularExponent = gl.getAttribLocation(program, "vSpecularExponent");

    // fetch light uniforms
    ambient_light = gl.getUniformLocation(program, "ambient_light");

    // initialize number of lights
    NUM_LIGHTS = 5;

    // fetch light uniforms and initialize light switches
    lightPosition = [];
    lightColor = [];
    lightDirection = [];
    on_off = [];
    lightSwitches = [];
    for(let i:number = 0; i < NUM_LIGHTS; i++) {
        // use template literals to loop through lights and retrieve each one
        lightPosition[i] = gl.getUniformLocation(program, `lightPosition[${i}]`);
        lightColor[i] = gl.getUniformLocation(program, `lightColor[${i}]`);
        lightDirection[i] = gl.getUniformLocation(program, `lightDirection[${i}]`);
        on_off[i] = gl.getUniformLocation(program, `on_off[${i}]`);
        lightSwitches[i] = false;
    }

    // headlights should be turned on by default
    lightSwitches[1] = lightSwitches[2] = true;

    // initialize vertex offsets
    carverts = 0;
    driververts = 0;
    groundverts = 0;
    buildingverts = 0;
    wheelverts = 0;
    emergencyboxverts = 0;

    // initialize various animation parameters
    xoffset = zoffset = 0;
    xrot = yrot = zrot = headRot = heading = boxSpin = 0;
    zoom = 45.0;
    dolly = 40.0;
    freeRoamFixed = true;
    cameras = [];
    cameras[0] = true;
    cameras[1] = false;
    cameras[2] = false;

    if(updateInterval) {
        clearInterval(updateInterval)
    }
    // run at 60 frames per second
    updateInterval = window.setInterval(update, 16);

    //This will execute when the user hits a key
    window.addEventListener("keydown" ,function(event){
        switch(event.key) {
            case " ": // stop car from moving
                moveForward = false;
                moveBackward = false;
                break;
            case "ArrowUp": // make car move forward
                moveBackward = false;
                moveForward = true;
                break;
            case "ArrowDown": // make car move backward
                moveForward = false;
                moveBackward = true;
                break;
            case "ArrowRight": // turn car to the right
                if(yrot > -50.0) {
                    yrot -= 5.0;
                }
                break;
            case "ArrowLeft": // turn car to the left
                if(yrot < 50.0) {
                    yrot += 5.0;
                }
                break
            case "q": // zoom camera in
                if(zoom - 1.0 > 5) {
                    zoom -= 1.0;
                }
                break;
            case "w": // zoom camera out
                if(zoom + 1.0 < 150) {
                    zoom += 1.0;
                }
                break;
            case "a": // move camera backward
                if(dolly + 0.5 < 80) {
                    dolly += 0.5;
                }
                break;
            case "s": // move camera forward
                if(dolly - 0.5 > 0.5) {
                    dolly -= 0.5;
                }
                break;
            case "z": // rotate driver's head to the left
                headRot += 5.0;
                break;
            case "x": // rotate driver's head to the right
                headRot -= 5.0;
                break;
            case "f": // toggle between free roam fixed and free roam follow camera functionality
                if(freeRoamFixed && cameras[0]) {
                    freeRoamFixed = false;
                } else if (cameras[0]) {
                    freeRoamFixed = true;
                }
                break;
            case "r": // reset free roam camera to default settings
                dolly = 40.0;
                zoom = 45.0;
                break;
            case "1": // use free roam camera
                cameras[0] = true;
                cameras[1] = false;
                cameras[2] = false;
                break;
            case "2": // use viewpoint camera
                cameras[0] = false;
                cameras[1] = true;
                cameras[2] = false;
                break;
            case "3": // use chase camera
                cameras[0] = false;
                cameras[1] = false;
                cameras[2] = true;
                break;
            case "0": // toggle overhead light on and off
                lightSwitches[0] = !lightSwitches[0];
                gl.uniform1i(on_off[0], lightSwitches[0] ? 1 : 0);
                if(lightSwitches[0]) { // set background color to black if night, sky blue if day
                    gl.clearColor(0.529, 0.808, 0.922, 1.0);
                } else {
                    gl.clearColor(0.0, 0.0, 0.0, 1.0);
                }
                break;
            case "9": // toggle headlights on and off
                lightSwitches[1] = !lightSwitches[1];
                lightSwitches[2] = !lightSwitches[2];
                gl.uniform1i(on_off[1], lightSwitches[1] ? 1 : 0);
                gl.uniform1i(on_off[2], lightSwitches[2] ? 1 : 0);
                break;
            case "8": // toggle emergency lights on and off
                lightSwitches[3] = !lightSwitches[3];
                lightSwitches[4] = !lightSwitches[4];
                gl.uniform1i(on_off[3], lightSwitches[3] ? 1 : 0);
                gl.uniform1i(on_off[4], lightSwitches[4] ? 1 : 0);
                break;
        }
        requestAnimationFrame(render);//and now we need a new frame since we made a change
    });

    // draw all the objects
    makeCarGroundAndBuffer();

    // draw to the whole canvas
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);

    // set background color to black
    gl.clearColor(0.0, 0.0, 0.0, 1.0);

    //we need to do this to avoid having objects that are behind other objects show up anyway
    gl.enable(gl.DEPTH_TEST);
};

//Make all of the objects and send them over to the graphics card
function makeCarGroundAndBuffer(){
    let points:vec4[] = []; //empty array

    // add car body
    //left face = 6 verts, position then color
    points.push(new vec4(1.5, -0.5, 0.5, 1.0));
    points.push(new vec4(0.0, 0.0, 1.0, 0.0)); //normal
    points.push(new vec4(0.0, 1.0, 1.0, 1.0)); //cyan
    points.push(new vec4(1.5, 0.5, 0.5, 1.0));
    points.push(new vec4(0.0, 0.0, 1.0, 0.0)); //normal
    points.push(new vec4(0.0, 1.0, 1.0, 1.0)); //cyan
    points.push(new vec4(-1.5, 0.5, 0.5, 1.0));
    points.push(new vec4(0.0, 0.0, 1.0, 0.0)); //normal
    points.push(new vec4(0.0, 1.0, 1.0, 1.0)); //cyan
    points.push(new vec4(-1.5, 0.5, 0.5, 1.0));
    points.push(new vec4(0.0, 0.0, 1.0, 0.0)); //normal
    points.push(new vec4(0.0, 1.0, 1.0, 1.0)); //cyan
    points.push(new vec4(-1.5, -0.5, 0.5, 1.0));
    points.push(new vec4(0.0, 0.0, 1.0, 0.0)); //normal
    points.push(new vec4(0.0, 1.0, 1.0, 1.0)); //cyan
    points.push(new vec4(1.5, -0.5, 0.5, 1.0));
    points.push(new vec4(0.0, 0.0, 1.0, 0.0)); //normal
    points.push(new vec4(0.0, 1.0, 1.0, 1.0)); //cyan

    //right face
    points.push(new vec4(-1.5, -0.5, -0.5, 1.0));
    points.push(new vec4(0.0, 0.0, -1.0, 0.0)); //normal
    points.push(new vec4(1.0, 0.0, 1.0, 1.0)); //magenta
    points.push(new vec4(-1.5, 0.5, -0.5, 1.0));
    points.push(new vec4(0.0, 0.0, -1.0, 0.0)); //normal
    points.push(new vec4(1.0, 0.0, 1.0, 1.0));//magenta
    points.push(new vec4(1.5, 0.5, -0.5, 1.0));
    points.push(new vec4(0.0, 0.0, -1.0, 0.0)); //normal
    points.push(new vec4(1.0, 0.0, 1.0, 1.0));//magenta
    points.push(new vec4(1.5, 0.5, -0.5, 1.0));
    points.push(new vec4(0.0, 0.0, -1.0, 0.0)); //normal
    points.push(new vec4(1.0, 0.0, 1.0, 1.0));//magenta
    points.push(new vec4(1.5, -0.5, -0.5, 1.0));
    points.push(new vec4(0.0, 0.0, -1.0, 0.0)); //normal
    points.push(new vec4(1.0, 0.0, 1.0, 1.0));//magenta
    points.push(new vec4(-1.5, -0.5, -0.5, 1.0));
    points.push(new vec4(0.0, 0.0, -1.0, 0.0)); //normal
    points.push(new vec4(1.0, 0.0, 1.0, 1.0));//magenta

    //back face
    points.push(new vec4(1.5, 0.5, 0.5, 1.0));
    points.push(new vec4(1.0, 0.0, 0.0, 0.0)); //normal
    points.push(new vec4(1.5, 1.0, 0.0, 1.0)); //yellow
    points.push(new vec4(1.5, -0.5, 0.5, 1.0));
    points.push(new vec4(1.0, 0.0, 0.0, 0.0)); //normal
    points.push(new vec4(1.5, 1.0, 0.0, 1.0)); //yellow
    points.push(new vec4(1.5, -0.5, -0.5, 1.0));
    points.push(new vec4(1.0, 0.0, 0.0, 0.0)); //normal
    points.push(new vec4(1.5, 1.0, 0.0, 1.0)); //yellow
    points.push(new vec4(1.5, -0.5, -0.5, 1.0));
    points.push(new vec4(1.0, 0.0, 0.0, 0.0)); //normal
    points.push(new vec4(1.5, 1.0, 0.0, 1.0)); //yellow
    points.push(new vec4(1.5, 0.5, -0.5, 1.0));
    points.push(new vec4(1.0, 0.0, 0.0, 0.0)); //normal
    points.push(new vec4(1.5, 1.0, 0.0, 1.0)); //yellow
    points.push(new vec4(1.5, 0.5, 0.5, 1.0));
    points.push(new vec4(1.0, 0.0, 0.0, 0.0)); //normal
    points.push(new vec4(1.5, 1.0, 0.0, 1.0)); //yellow

    //front face
    points.push(new vec4(-1.5, 0.5, -0.5, 1.0));
    points.push(new vec4(-1.0, 0.0, 0.0, 0.0)); //normal
    points.push(new vec4(1.0, 0.0, 0.0, 1.0)); //red
    points.push(new vec4(-1.5, -0.5, -0.5, 1.0));
    points.push(new vec4(-1.0, 0.0, 0.0, 0.0)); //normal
    points.push(new vec4(1.0, 0.0, 0.0, 1.0)); //red
    points.push(new vec4(-1.5, -0.5, 0.5, 1.0));
    points.push(new vec4(-1.0, 0.0, 0.0, 0.0)); //normal
    points.push(new vec4(1.0, 0.0, 0.0, 1.0)); //red
    points.push(new vec4(-1.5, -0.5, 0.5, 1.0));
    points.push(new vec4(-1.0, 0.0, 0.0, 0.0)); //normal
    points.push(new vec4(1.0, 0.0, 0.0, 1.0)); //red
    points.push(new vec4(-1.5, 0.5, 0.5, 1.0));
    points.push(new vec4(-1.0, 0.0, 0.0, 0.0)); //normal
    points.push(new vec4(1.0, 0.0, 0.0, 1.0)); //red
    points.push(new vec4(-1.5, 0.5, -0.5, 1.0));
    points.push(new vec4(-1.0, 0.0, 0.0, 0.0)); //normal
    points.push(new vec4(1.0, 0.0, 0.0, 1.0)); //red

    //top
    points.push(new vec4(1.5, 0.5, 0.5, 1.0));
    points.push(new vec4(0.0, 1.0, 0.0, 0.0)); //normal
    points.push(new vec4(0.0, 0.0, 1.0, 1.0)); //blue
    points.push(new vec4(1.5, 0.5, -0.5, 1.0));
    points.push(new vec4(0.0, 1.0, 0.0, 0.0)); //normal
    points.push(new vec4(0.0, 0.0, 1.0, 1.0)); //blue
    points.push(new vec4(-1.5, 0.5, -0.5, 1.0));
    points.push(new vec4(0.0, 1.0, 0.0, 0.0)); //normal
    points.push(new vec4(0.0, 0.0, 1.0, 1.0)); //blue
    points.push(new vec4(-1.5, 0.5, -0.5, 1.0));
    points.push(new vec4(0.0, 1.0, 0.0, 0.0)); //normal
    points.push(new vec4(0.0, 0.0, 1.0, 1.0)); //blue
    points.push(new vec4(-1.5, 0.5, 0.5, 1.0));
    points.push(new vec4(0.0, 1.0, 0.0, 0.0)); //normal
    points.push(new vec4(0.0, 0.0, 1.0, 1.0)); //blue
    points.push(new vec4(1.5, 0.5, 0.5, 1.0));
    points.push(new vec4(0.0, 1.0, 0.0, 0.0)); //normal
    points.push(new vec4(0.0, 0.0, 1.0, 1.0)); //blue

    //bottom
    points.push(new vec4(1.5, -0.5, -0.5, 1.0));
    points.push(new vec4(0.0, -1.0, 0.0, 0.0)); //normal
    points.push(new vec4(0.0, 1.0, 0.0, 1.0)); //green
    points.push(new vec4(1.5, -0.5, 0.5, 1.0));
    points.push(new vec4(0.0, -1.0, 0.0, 0.0)); //normal
    points.push(new vec4(0.0, 1.0, 0.0, 1.0)); //green
    points.push(new vec4(-1.5, -0.5, 0.5, 1.0));
    points.push(new vec4(0.0, -1.0, 0.0, 0.0)); //normal
    points.push(new vec4(0.0, 1.0, 0.0, 1.0)); //green
    points.push(new vec4(-1.5, -0.5, 0.5, 1.0));
    points.push(new vec4(0.0, -1.0, 0.0, 0.0)); //normal
    points.push(new vec4(0.0, 1.0, 0.0, 1.0)); //green
    points.push(new vec4(-1.5, -0.5, -0.5, 1.0));
    points.push(new vec4(0.0, -1.0, 0.0, 0.0)); //normal
    points.push(new vec4(0.0, 1.0, 0.0, 1.0)); //green
    points.push(new vec4(1.5, -0.5, -0.5, 1.0));
    points.push(new vec4(0.0, -1.0, 0.0, 0.0)); //normal
    points.push(new vec4(0.0, 1.0, 0.0, 1.0)); //green

    carverts = points.length / 3;

    // add a driver
    //left face
    points.push(new vec4(-1.3, 0.5, 0.3, 1.0));
    points.push(new vec4(0.0, 0.0, 1.0, 0.0)); //normal
    points.push(new vec4(1.0, 1.0, 1.0, 1.0)); //white
    points.push(new vec4(-1.3, 1.1, 0.3, 1.0));
    points.push(new vec4(0.0, 0.0, 1.0, 0.0)); //normal
    points.push(new vec4(1.0, 1.0, 1.0, 1.0)); //white
    points.push(new vec4(-0.7, 0.5, 0.3, 1.0));
    points.push(new vec4(0.0, 0.0, 1.0, 0.0)); //normal
    points.push(new vec4(1.0, 1.0, 1.0, 1.0)); //white
    points.push(new vec4(-0.7, 0.5, 0.3, 1.0));
    points.push(new vec4(0.0, 0.0, 1.0, 0.0)); //normal
    points.push(new vec4(1.0, 1.0, 1.0, 1.0)); //white
    points.push(new vec4(-1.3, 1.1, 0.3, 1.0));
    points.push(new vec4(0.0, 0.0, 1.0, 0.0)); //normal
    points.push(new vec4(1.0, 1.0, 1.0, 1.0)); //white
    points.push(new vec4(-0.7, 1.1, 0.3, 1.0));
    points.push(new vec4(0.0, 0.0, 1.0, 0.0)); //normal
    points.push(new vec4(1.0, 1.0, 1.0, 1.0)); //white

    //right face
    points.push(new vec4(-1.3, 0.5, -0.3, 1.0));
    points.push(new vec4(0.0, 0.0, -1.0, 0.0)); //normal
    points.push(new vec4(1.0, 1.0, 1.0, 1.0)); //white
    points.push(new vec4(-1.3, 1.1, -0.3, 1.0));
    points.push(new vec4(0.0, 0.0, -1.0, 0.0)); //normal
    points.push(new vec4(1.0, 1.0, 1.0, 1.0)); //white
    points.push(new vec4(-0.7, 0.5, -0.3, 1.0));
    points.push(new vec4(0.0, 0.0, -1.0, 0.0)); //normal
    points.push(new vec4(1.0, 1.0, 1.0, 1.0)); //white
    points.push(new vec4(-0.7, 0.5, -0.3, 1.0));
    points.push(new vec4(0.0, 0.0, -1.0, 0.0)); //normal
    points.push(new vec4(1.0, 1.0, 1.0, 1.0)); //white
    points.push(new vec4(-1.3, 1.1, -0.3, 1.0));
    points.push(new vec4(0.0, 0.0, -1.0, 0.0)); //normal
    points.push(new vec4(1.0, 1.0, 1.0, 1.0)); //white
    points.push(new vec4(-0.7, 1.1, -0.3, 1.0));
    points.push(new vec4(0.0, 0.0, -1.0, 0.0)); //normal
    points.push(new vec4(1.0, 1.0, 1.0, 1.0)); //white

    //back face
    points.push(new vec4(-0.7, 0.5, 0.3, 1.0));
    points.push(new vec4(1.0, 0.0, 0.0, 0.0)); //normal
    points.push(new vec4(1.0, 1.0, 1.0, 1.0)); //white
    points.push(new vec4(-0.7, 1.1, 0.3, 1.0));
    points.push(new vec4(1.0, 0.0, 0.0, 0.0)); //normal
    points.push(new vec4(1.0, 1.0, 1.0, 1.0)); //white
    points.push(new vec4(-0.7, 0.5, -0.3, 1.0));
    points.push(new vec4(1.0, 0.0, 0.0, 0.0)); //normal
    points.push(new vec4(1.0, 1.0, 1.0, 1.0)); //white
    points.push(new vec4(-0.7, 0.5, -0.3, 1.0));
    points.push(new vec4(1.0, 0.0, 0.0, 0.0)); //normal
    points.push(new vec4(1.0, 1.0, 1.0, 1.0)); //white
    points.push(new vec4(-0.7, 1.1, 0.3, 1.0));
    points.push(new vec4(1.0, 0.0, 0.0, 0.0)); //normal
    points.push(new vec4(1.0, 1.0, 1.0, 1.0)); //white
    points.push(new vec4(-0.7, 1.1, -0.3, 1.0));
    points.push(new vec4(1.0, 0.0, 0.0, 0.0)); //normal
    points.push(new vec4(1.0, 1.0, 1.0, 1.0)); //white

    //front face
    points.push(new vec4(-1.3, 0.5, 0.3, 1.0));
    points.push(new vec4(-1.0, 0.0, 0.0, 0.0)); //normal
    points.push(new vec4(1.0, 1.0, 1.0, 1.0)); //white
    points.push(new vec4(-1.3, 1.1, 0.3, 1.0));
    points.push(new vec4(-1.0, 0.0, 0.0, 0.0)); //normal
    points.push(new vec4(1.0, 1.0, 1.0, 1.0)); //white
    points.push(new vec4(-1.3, 0.5, -0.3, 1.0));
    points.push(new vec4(-1.0, 0.0, 0.0, 0.0)); //normal
    points.push(new vec4(1.0, 1.0, 1.0, 1.0)); //white
    points.push(new vec4(-1.3, 0.5, -0.3, 1.0));
    points.push(new vec4(-1.0, 0.0, 0.0, 0.0)); //normal
    points.push(new vec4(1.0, 1.0, 1.0, 1.0)); //white
    points.push(new vec4(-1.3, 1.1, 0.3, 1.0));
    points.push(new vec4(-1.0, 0.0, 0.0, 0.0)); //normal
    points.push(new vec4(1.0, 1.0, 1.0, 1.0)); //white
    points.push(new vec4(-1.3, 1.1, -0.3, 1.0));
    points.push(new vec4(-1.0, 0.0, 0.0, 0.0)); //normal
    points.push(new vec4(1.0, 1.0, 1.0, 1.0)); //white

    //top
    points.push(new vec4(-1.3, 1.1, 0.3, 1.0));
    points.push(new vec4(0.0, 1.0, 0.0, 0.0)); //normal
    points.push(new vec4(1.0, 1.0, 1.0, 1.0)); //white
    points.push(new vec4(-1.3, 1.1, -0.3, 1.0));
    points.push(new vec4(0.0, 1.0, 0.0, 0.0)); //normal
    points.push(new vec4(1.0, 1.0, 1.0, 1.0)); //white
    points.push(new vec4(-0.7, 1.1, 0.3, 1.0));
    points.push(new vec4(0.0, 1.0, 0.0, 0.0)); //normal
    points.push(new vec4(1.0, 1.0, 1.0, 1.0)); //white
    points.push(new vec4(-0.7, 1.1, 0.3, 1.0));
    points.push(new vec4(0.0, 1.0, 0.0, 0.0)); //normal
    points.push(new vec4(1.0, 1.0, 1.0, 1.0)); //white
    points.push(new vec4(-1.3, 1.1, -0.3, 1.0));
    points.push(new vec4(0.0, 1.0, 0.0, 0.0)); //normal
    points.push(new vec4(1.0, 1.0, 1.0, 1.0)); //white
    points.push(new vec4(-0.7, 1.1, -0.3, 1.0));
    points.push(new vec4(0.0, 1.0, 0.0, 0.0)); //normal
    points.push(new vec4(1.0, 1.0, 1.0, 1.0)); //white

    // add eyes
    // left eye
    points.push(new vec4(-1.35, 1.0, 0.2, 1.0));
    points.push(new vec4(-1.0, 0.0, 0.0, 0.0)); //normal
    points.push(new vec4(0.0, 0.0, 0.0, 1.0)); //black
    points.push(new vec4(-1.35, 0.9, 0.2, 1.0));
    points.push(new vec4(-1.0, 0.0, 0.0, 0.0)); //normal
    points.push(new vec4(0.0, 0.0, 0.0, 1.0)); //black
    points.push(new vec4(-1.35, 0.9, 0.1, 1.0));
    points.push(new vec4(-1.0, 0.0, 0.0, 0.0)); //normal
    points.push(new vec4(0.0, 0.0, 0.0, 1.0)); //black

    points.push(new vec4(-1.35, 0.9, 0.1, 1.0));
    points.push(new vec4(-1.0, 0.0, 0.0, 0.0)); //normal
    points.push(new vec4(0.0, 0.0, 0.0, 1.0)); //black
    points.push(new vec4(-1.35, 1.0, 0.1, 1.0));
    points.push(new vec4(-1.0, 0.0, 0.0, 0.0)); //normal
    points.push(new vec4(0.0, 0.0, 0.0, 1.0)); //black
    points.push(new vec4(-1.35, 1.0, 0.2, 1.0));
    points.push(new vec4(-1.0, 0.0, 0.0, 0.0)); //normal
    points.push(new vec4(0.0, 0.0, 0.0, 1.0)); //black

    // right eye
    points.push(new vec4(-1.35, 1.0, -0.2, 1.0));
    points.push(new vec4(-1.0, 0.0, 0.0, 0.0)); //normal
    points.push(new vec4(0.0, 0.0, 0.0, 1.0)); //black
    points.push(new vec4(-1.35, 0.9, -0.2, 1.0));
    points.push(new vec4(-1.0, 0.0, 0.0, 0.0)); //normal
    points.push(new vec4(0.0, 0.0, 0.0, 1.0)); //black
    points.push(new vec4(-1.35, 0.9, -0.1, 1.0));
    points.push(new vec4(-1.0, 0.0, 0.0, 0.0)); //normal
    points.push(new vec4(0.0, 0.0, 0.0, 1.0)); //black

    points.push(new vec4(-1.35, 0.9, -0.1, 1.0));
    points.push(new vec4(-1.0, 0.0, 0.0, 0.0)); //normal
    points.push(new vec4(0.0, 0.0, 0.0, 1.0)); //black
    points.push(new vec4(-1.35, 1.0, -0.1, 1.0));
    points.push(new vec4(-1.0, 0.0, 0.0, 0.0)); //normal
    points.push(new vec4(0.0, 0.0, 0.0, 1.0)); //black
    points.push(new vec4(-1.35, 1.0, -0.2, 1.0));
    points.push(new vec4(-1.0, 0.0, 0.0, 0.0)); //normal
    points.push(new vec4(0.0, 0.0, 0.0, 1.0)); //black

    driververts = (points.length / 3) - carverts;

    // add the ground
    // First Triangle
    points.push(new vec4(-50.0, -0.5, -50.0, 1.0));
    points.push(new vec4(0.0, 1.0, 0.0, 0.0)); //normal
    points.push(new vec4(0.0, 0.5, 0.0, 1.0)); //dark green
    points.push(new vec4(50.0, -0.5, -50.0, 1.0));
    points.push(new vec4(0.0, 1.0, 0.0, 0.0)); //normal
    points.push(new vec4(0.0, 0.5, 0.0, 1.0)); //dark green
    points.push(new vec4(50.0, -0.5, 50.0, 1.0));
    points.push(new vec4(0.0, 1.0, 0.0, 0.0)); //normal
    points.push(new vec4(0.0, 0.5, 0.0, 1.0)); //dark green

    // Second Triangle
    points.push(new vec4(-50.0, -0.5, -50.0, 1.0));
    points.push(new vec4(0.0, 1.0, 0.0, 0.0)); //normal
    points.push(new vec4(0.0, 0.5, 0.0, 1.0)); //dark green
    points.push(new vec4(50.0, -0.5, 50.0, 1.0));
    points.push(new vec4(0.0, 1.0, 0.0, 0.0)); //normal
    points.push(new vec4(0.0, 0.5, 0.0, 1.0)); //dark green
    points.push(new vec4(-50.0, -0.5, 50.0, 1.0));
    points.push(new vec4(0.0, 1.0, 0.0, 0.0)); //normal
    points.push(new vec4(0.0, 0.5, 0.0, 1.0)); //dark green

    groundverts = (points.length / 3) - carverts - driververts;

    // add a sphereical building (reference object) model
    let subdiv:number = 15;
    let r:number = 2.5;
    let step:number = (360.0 / subdiv)*(Math.PI / 180.0);

    for (let lat:number = 0; lat <= Math.PI ; lat += step){ //latitude
        for (let lon:number = 0; lon + step <= 2*Math.PI; lon += step){ //longitude
            //triangle 1
            points.push(new vec4(r * Math.sin(lat) * Math.sin(lon) , r * Math.cos(lat) , r *  Math.cos(lon) * Math.sin(lat), 1.0));
            points.push(new vec4(r * Math.sin(lat) * Math.sin(lon), r * Math.cos(lat), r * Math.cos(lon) * Math.sin(lat),  0.0)); //normal
            points.push(new vec4(0.5, 0.5, 0.5, 1.0)); //gray
            points.push(new vec4(r * Math.sin(lat) * Math.sin(lon + step), r * Math.cos(lat), r * Math.sin(lat) * Math.cos(lon + step),  1.0));
            points.push(new vec4(r * Math.sin(lat) * Math.sin(lon + step), r *  Math.cos(lat), r * Math.sin(lat) * Math.cos(lon + step), 0.0)); //normal
            points.push(new vec4(0.5, 0.5, 0.5, 1.0)); //gray
            points.push(new vec4(r * Math.sin(lat + step) * Math.sin(lon + step), r *  Math.cos(lat + step), r * Math.cos(lon + step) * Math.sin(lat + step),  1.0));
            points.push(new vec4(r * Math.sin(lat + step) * Math.sin(lon + step), r * Math.cos(lat + step), r * Math.cos(lon + step) * Math.sin(lat + step),  0.0)); //normal
            points.push(new vec4(0.5, 0.5, 0.5, 1.0)); //gray

            //triangle 2
            points.push(new vec4(r * Math.sin(lat + step) * Math.sin(lon + step), r *  Math.cos(lat + step), r * Math.cos(lon + step) * Math.sin(lat + step), 1.0));
            points.push(new vec4(r * Math.sin(lat + step) * Math.sin(lon + step), r *  Math.cos(lat + step), r * Math.cos(lon + step) * Math.sin(lat + step), 0.0)); //normal
            points.push(new vec4(0.5, 0.5, 0.5, 1.0)); //gray
            points.push(new vec4(r * Math.sin(lat + step) * Math.sin(lon), r *  Math.cos(lat + step), r * Math.sin(lat + step) * Math.cos(lon),  1.0));
            points.push(new vec4(r * Math.sin(lat + step) * Math.sin(lon), r *  Math.cos(lat + step), r *  Math.sin(lat + step) * Math.cos(lon), 0.0)); //normal
            points.push(new vec4(0.5, 0.5, 0.5, 1.0)); //gray
            points.push(new vec4(r * Math.sin(lat) * Math.sin(lon), r *  Math.cos(lat), r * Math.cos(lon) * Math.sin(lat),  1.0));
            points.push(new vec4(r * Math.sin(lat) * Math.sin(lon), r *  Math.cos(lat), r * Math.cos(lon) * Math.sin(lat), 0.0)); //normal
            points.push(new vec4(0.5, 0.5, 0.5, 1.0)); //gray
        }
    }

    buildingverts = (points.length / 3) - carverts - driververts - groundverts;

    // add a wheel to be drawn four times
    let angleStep:number = (2 * Math.PI) / 32;

    for(let i:number = 0; i < 32; i++) {
        let theta1: number = i * angleStep;
        let theta2: number = (i + 1) * angleStep;

        // outer rim of wheel vertex coordinates
        let x1: number = 0.5 * Math.cos(theta1);
        let z1: number = 0.5 * Math.sin(theta1);
        let x2: number = 0.5 * Math.cos(theta2);
        let z2: number = 0.5 * Math.sin(theta2);

        // rectangular slices to create the round side of cylinder

        // Triangle 1
        points.push(new vec4(x1, -0.05, z1, 1.0));
        points.push(new vec4(x1 / 0.5, 0.0, z1 / 0.5, 0.0)); // normal
        points.push(new vec4(0, 0, 0, 1.0)); // black
        points.push(new vec4(x2, -0.05, z2, 1.0));
        points.push(new vec4(x2 / 0.5, 0.0, z2 / 0.5, 0.0)); // normal
        points.push(new vec4(0, 0, 0, 1.0)); // black
        points.push(new vec4(x1, 0.05, z1, 1.0));
        points.push(new vec4(x1 / 0.5, 0.0, z1 / 0.5, 0.0)); // normal
        points.push(new vec4(0, 0, 0, 1.0)); // black

        // Triangle 2
        points.push(new vec4(x2, -0.05, z2, 1.0));
        points.push(new vec4(x2 / 0.5, 0.0, z2 / 0.5, 0.0)); // normal
        points.push(new vec4(0, 0, 0, 1.0)); // black
        points.push(new vec4(x2, 0.05, z2, 1.0));
        points.push(new vec4(x2 / 0.5, 0.0, z2 / 0.5, 0.0)); // normal
        points.push(new vec4(0, 0, 0, 1.0)); // black
        points.push(new vec4(x1, 0.05, z1, 1.0));
        points.push(new vec4(x1 / 0.5, 0.0, z1 / 0.5, 0.0)); // normal
        points.push(new vec4(0, 0, 0, 1.0)); // black

        // bottom circle
        points.push(new vec4(0, -0.05, 0, 1.0));
        points.push(new vec4(0.0, -1.0, 0.0, 0.0)); // normal
        points.push(new vec4(1, i/32.0, i/32.0, 1.0)); // red shade
        points.push(new vec4(x2, -0.05, z2, 1.0));
        points.push(new vec4(0.0, -1.0, 0.0, 0.0)); // normal
        points.push(new vec4(1, i/32.0, i/32.0, 1.0)); // red shade
        points.push(new vec4(x1, -0.05, z1, 1.0));
        points.push(new vec4(0.0, -1.0, 0.0, 0.0)); // normal
        points.push(new vec4(1, i/32.0, i/32.0, 1.0)); // red shade

        // top circle
        points.push(new vec4(0, 0.05, 0, 1.0));
        points.push(new vec4(0.0, 1.0, 0.0, 0.0)); // normal
        points.push(new vec4(1, i/32.0, i/32.0, 1.0)); // red shade
        points.push(new vec4(x1, 0.05, z1, 1.0));
        points.push(new vec4(0.0, 1.0, 0.0, 0.0)); // normal
        points.push(new vec4(1, i/32.0, i/32.0, 1.0)); // red shade
        points.push(new vec4(x2, 0.05, z2, 1.0));
        points.push(new vec4(0.0, 1.0, 0.0, 0.0)); // normal
        points.push(new vec4(1, i/32.0, i/32.0, 1.0)); // red shade

    }

    wheelverts = (points.length / 3) - carverts - driververts - groundverts - buildingverts;

    // add headlight circle to be drawn twice
    for(let i:number = 0; i < 32; i++) {
        let theta1: number = i * angleStep;
        let theta2: number = (i + 1) * angleStep;

        // outer rim of circle coordinates
        let x1: number = 0.1 * Math.cos(theta1);
        let z1: number = 0.1 * Math.sin(theta1);
        let x2: number = 0.1 * Math.cos(theta2);
        let z2: number = 0.1 * Math.sin(theta2);

        // circle
        points.push(new vec4(0.0, 0.0, 0.0, 1.0));
        points.push(new vec4(0.0, 1.0, 0.0, 0.0)); // normal
        points.push(new vec4(1.0, 1.0, 1.0, 1.0)); // white
        points.push(new vec4(x1, 0.0, z1, 1.0));
        points.push(new vec4(0.0, 1.0, 0.0, 0.0)); // normal
        points.push(new vec4(1.0, 1.0, 1.0, 1.0)); // white
        points.push(new vec4(x2, 0.0, z2, 1.0));
        points.push(new vec4(0.0, 1.0, 0.0, 0.0)); // normal
        points.push(new vec4(1.0, 1.0, 1.0, 1.0)); // white
    }

    headlightverts = (points.length / 3) - carverts - driververts - groundverts - buildingverts - wheelverts;

    // add box for emergency lights
    //left face
    points.push(new vec4(-0.2, -0.2, 0.2, 1.0));
    points.push(new vec4(0.0, 0.0, 1.0, 0.0)); //normal
    points.push(new vec4(0.5, 0.5, 0.5, 1.0)); //gray
    points.push(new vec4(-0.2, 0.2, 0.2, 1.0));
    points.push(new vec4(0.0, 0.0, 1.0, 0.0)); //normal
    points.push(new vec4(0.5, 0.5, 0.5, 1.0)); //gray
    points.push(new vec4(0.2, -0.2, 0.2, 1.0));
    points.push(new vec4(0.0, 0.0, 1.0, 0.0)); //normal
    points.push(new vec4(0.5, 0.5, 0.5, 1.0)); //gray
    points.push(new vec4(0.2, -0.2, 0.2, 1.0));
    points.push(new vec4(0.0, 0.0, 1.0, 0.0)); //normal
    points.push(new vec4(0.5, 0.5, 0.5, 1.0)); //gray
    points.push(new vec4(-0.2, 0.2, 0.2, 1.0));
    points.push(new vec4(0.0, 0.0, 1.0, 0.0)); //normal
    points.push(new vec4(0.5, 0.5, 0.5, 1.0)); //gray
    points.push(new vec4(0.2, 0.2, 0.2, 1.0));
    points.push(new vec4(0.0, 0.0, 1.0, 0.0)); //normal
    points.push(new vec4(0.5, 0.5, 0.5, 1.0)); //gray

    //right face
    points.push(new vec4(-0.2, -0.2, -0.2, 1.0));
    points.push(new vec4(0.0, 0.0, 1.0, 0.0)); //normal
    points.push(new vec4(0.5, 0.5, 0.5, 1.0)); //gray
    points.push(new vec4(-0.2, 0.2, -0.2, 1.0));
    points.push(new vec4(0.0, 0.0, 1.0, 0.0)); //normal
    points.push(new vec4(0.5, 0.5, 0.5, 1.0)); //gray
    points.push(new vec4(0.2, -0.2, -0.2, 1.0));
    points.push(new vec4(0.0, 0.0, 1.0, 0.0)); //normal
    points.push(new vec4(0.5, 0.5, 0.5, 1.0)); //gray
    points.push(new vec4(0.2, -0.2, -0.2, 1.0));
    points.push(new vec4(0.0, 0.0, 1.0, 0.0)); //normal
    points.push(new vec4(0.5, 0.5, 0.5, 1.0)); //gray
    points.push(new vec4(-0.2, 0.2, -0.2, 1.0));
    points.push(new vec4(0.0, 0.0, 1.0, 0.0)); //normal
    points.push(new vec4(0.5, 0.5, 0.5, 1.0)); //gray
    points.push(new vec4(0.2, 0.2, -0.2, 1.0));
    points.push(new vec4(0.0, 0.0, 1.0, 0.0)); //normal
    points.push(new vec4(0.5, 0.5, 0.5, 1.0)); //gray

    //back face
    points.push(new vec4(0.2, -0.2, 0.2, 1.0));
    points.push(new vec4(1.0, 0.0, 0.0, 0.0)); //normal
    points.push(new vec4(0.5, 0.5, 0.5, 1.0)); //gray
    points.push(new vec4(0.2, 0.2, 0.2, 1.0));
    points.push(new vec4(1.0, 0.0, 0.0, 0.0)); //normal
    points.push(new vec4(0.5, 0.5, 0.5, 1.0)); //gray
    points.push(new vec4(0.2, -0.2, -0.2, 1.0));
    points.push(new vec4(1.0, 0.0, 0.0, 0.0)); //normal
    points.push(new vec4(0.5, 0.5, 0.5, 1.0)); //gray
    points.push(new vec4(0.2, -0.2, -0.2, 1.0));
    points.push(new vec4(1.0, 0.0, 0.0, 0.0)); //normal
    points.push(new vec4(0.5, 0.5, 0.5, 1.0)); //gray
    points.push(new vec4(0.2, 0.2, 0.2, 1.0));
    points.push(new vec4(1.0, 0.0, 0.0, 0.0)); //normal
    points.push(new vec4(0.5, 0.5, 0.5, 1.0)); //gray
    points.push(new vec4(0.2, 0.2, -0.2, 1.0));
    points.push(new vec4(1.0, 0.0, 0.0, 0.0)); //normal
    points.push(new vec4(0.5, 0.5, 0.5, 1.0)); //gray

    //front face
    points.push(new vec4(-0.2, -0.2, 0.2, 1.0));
    points.push(new vec4(1.0, 0.0, 0.0, 0.0)); //normal
    points.push(new vec4(0.5, 0.5, 0.5, 1.0)); //gray
    points.push(new vec4(-0.2, 0.2, 0.2, 1.0));
    points.push(new vec4(1.0, 0.0, 0.0, 0.0)); //normal
    points.push(new vec4(0.5, 0.5, 0.5, 1.0)); //gray
    points.push(new vec4(-0.2, -0.2, -0.2, 1.0));
    points.push(new vec4(1.0, 0.0, 0.0, 0.0)); //normal
    points.push(new vec4(0.5, 0.5, 0.5, 1.0)); //gray
    points.push(new vec4(-0.2, -0.2, -0.2, 1.0));
    points.push(new vec4(1.0, 0.0, 0.0, 0.0)); //normal
    points.push(new vec4(0.5, 0.5, 0.5, 1.0)); //gray
    points.push(new vec4(-0.2, 0.2, 0.2, 1.0));
    points.push(new vec4(1.0, 0.0, 0.0, 0.0)); //normal
    points.push(new vec4(0.5, 0.5, 0.5, 1.0)); //gray
    points.push(new vec4(-0.2, 0.2, -0.2, 1.0));
    points.push(new vec4(1.0, 0.0, 0.0, 0.0)); //normal
    points.push(new vec4(0.5, 0.5, 0.5, 1.0)); //gray

    //top
    points.push(new vec4(-0.2, 0.2, 0.2, 1.0));
    points.push(new vec4(0.0, 1.0, 0.0, 0.0)); //normal
    points.push(new vec4(0.5, 0.5, 0.5, 1.0)); //gray
    points.push(new vec4(-0.2, 0.2, -0.2, 1.0));
    points.push(new vec4(0.0, 1.0, 0.0, 0.0)); //normal
    points.push(new vec4(0.5, 0.5, 0.5, 1.0)); //gray
    points.push(new vec4(0.2, 0.2, 0.2, 1.0));
    points.push(new vec4(0.0, 1.0, 0.0, 0.0)); //normal
    points.push(new vec4(0.5, 0.5, 0.5, 1.0)); //gray
    points.push(new vec4(0.2, 0.2, 0.2, 1.0));
    points.push(new vec4(0.0, 1.0, 0.0, 0.0)); //normal
    points.push(new vec4(0.5, 0.5, 0.5, 1.0)); //gray
    points.push(new vec4(-0.2, 0.2, -0.2, 1.0));
    points.push(new vec4(0.0, 1.0, 0.0, 0.0)); //normal
    points.push(new vec4(0.5, 0.5, 0.5, 1.0)); //gray
    points.push(new vec4(0.2, 0.2, -0.2, 1.0));
    points.push(new vec4(0.0, 1.0, 0.0, 0.0)); //normal
    points.push(new vec4(0.5, 0.5, 0.5, 1.0)); //gray

    emergencyboxverts = (points.length / 3) - carverts - driververts - groundverts - buildingverts - wheelverts - headlightverts;

    //we need some graphics memory for this information
    bufferId = gl.createBuffer();
    //tell WebGL that the buffer we just created is the one we want to work with right now
    gl.bindBuffer(gl.ARRAY_BUFFER, bufferId);
    //send the local data over to this buffer on the graphics card
    gl.bufferData(gl.ARRAY_BUFFER, flatten(points), gl.STATIC_DRAW);

    //Data is packed in groups of 4 floats which are 4 bytes each, 48 bytes total for position, normal, and color
    // position                       normal                     color
    //  x   y   z     w        x     y     z     w        r     g     b     a
    // 0-3 4-7 8-11 12-15    16-19 20-23 24-27 28-31    32-35 36-39 40-43 44-47

    //The vertex shader has an attribute named "vPosition"
    vPosition = gl.getAttribLocation(program, "vPosition");

    //attribute location we just fetched, 4 elements in each vector, data type float, don't normalize this data,
    //each position starts 48 bytes after the start of the previous one, and starts right away at index 0

    gl.vertexAttribPointer(vPosition, 4, gl.FLOAT, false, 48, 0);
    gl.enableVertexAttribArray(vPosition);

    //The vertex shader also has an attribute named "vNormal"
    vNormal = gl.getAttribLocation(program, "vNormal");

    //attribute location we just fetched, 4 elements in each vector, data type float, don't normalize this data,
    //each normal starts 48 bytes after the start of the previous one, and the first normal starts 16 bytes into the data

    gl.vertexAttribPointer(vNormal, 4, gl.FLOAT, false, 48, 16);
    gl.enableVertexAttribArray(vNormal);

    //The vertex shader also has an attribute named "vColor"
    vColor = gl.getAttribLocation(program, "vColor");

    //attribute location we just fetched, 4 elements in each vector, data type float, don't normalize this data,
    //each color starts 32 bytes after the start of the previous one, and the first color starts 32 bytes into the data

    gl.vertexAttribPointer(vColor, 4, gl.FLOAT, false, 48, 32);
    gl.enableVertexAttribArray(vColor);
}

function update(){
    // steer the wheels by this amount in radians
    const steer:number = (yrot/2.0) * Math.PI / 180.0;
    // the speed of the car
    const speed:number = 0.05;

    if(moveForward) {
        zrot += 2.0;
        // rate of rotation of car is proportional to
        // tan(steer) / wheelbase (wheelbase = 2.0)
        heading += speed * Math.tan(steer) / 2.0;
        xoffset -= speed * Math.cos(heading);
        zoffset += speed * Math.sin(heading);
    } else if (moveBackward) {
        zrot -= 2.0;
        heading -= speed * Math.tan(steer) * 0.5;
        xoffset += speed * Math.cos(heading);
        zoffset -= speed * Math.sin(heading);
    }

    if(lightSwitches[3]) { // if emergency lights are on, rotate the emergency light box
        boxSpin += 5.0;
    }

    // stop car if it reaches the edge of the map
    if(xoffset >= 50.0 || xoffset <= -50.0 || zoffset >= 50.0 || zoffset <= -50.0) {
        moveForward = false;
        moveBackward = false;
    }

    requestAnimationFrame(render);
}

//draw a new frame
function render(){

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // set values for lights
    gl.vertexAttrib4fv(vSpecularColor, [1.0, 1.0, 1.0, 1.0]);
    gl.vertexAttrib1f(vSpecularExponent, 5.0);
    gl.uniform4fv(ambient_light, [0.3, 0.3, 0.3, 1]);

    // overhead light values
    gl.uniform4fv(lightPosition[0], [0, 50, 0, 1]);
    gl.uniform4fv(lightColor[0], [1, 1, 1, 1]);
    gl.uniform1i(on_off[0], lightSwitches[0] ? 1 : 0);

    let p:mat4;
    // zoom should only affect the free roam camera
    if(cameras[0]) {
        p = perspective(zoom, canvas.clientWidth / canvas.clientHeight, 1.0, 100.0);
    } else {
        p = perspective(45.0, canvas.clientWidth / canvas.clientHeight, 1.0, 100.0);
    }

    gl.uniformMatrix4fv(uproj, false, p.flatten());

    // lookAt params: Where is the camera? What is the location the camera is looking at? What direction is up?
    let lookAtMatrix:mat4;
    if(cameras[0]) {
        if (freeRoamFixed) {
            // camera should look at the center of the stage
            lookAtMatrix = lookAt(new vec4(0, 10, dolly, 1), new vec4(0, 0, 0, 1), new vec4(0, 1, 0, 0));
        } else {
            // camera should follow the car
            lookAtMatrix = lookAt(new vec4(0, 10, dolly, 1), new vec4(xoffset, 0, zoffset, 1), new vec4(0, 1, 0, 0));
        }
    } else if(cameras[1]) {
        // viewpoint (first-person) camera
        // driver's eyes in car-local coordinates
        let driverEyes:vec4 = new vec4(-1.35, 1.0, 0.0, 1.0);

        // eye position rotated by car's heading
        let eyeX:number = xoffset + driverEyes[0] * Math.cos(heading);
        let eyeY:number = driverEyes[1];
        let eyeZ:number = zoffset - driverEyes[0] * Math.sin(heading);

        // forward vector for looking direction
        let headRad:number = headRot * Math.PI / 180.0;
        let fwdX:number = Math.cos(headRad + heading + Math.PI);
        let fwdY:number = 0.0;
        let fwdZ:number = Math.sin(headRad + heading);

        // look-at point
        let lookX:number = eyeX + fwdX;
        let lookY:number = eyeY + fwdY;
        let lookZ:number = eyeZ + fwdZ;

        // set up camera
        lookAtMatrix = lookAt(new vec4(eyeX, eyeY, eyeZ, 1),
            new vec4(lookX, lookY, lookZ, 1),
            new vec4(0, 1, 0, 0));
    } else {
        // chase camera
        // camera's location in car-local coordinates
        let driverEyes:vec4 = new vec4(7.5, 3.0, 0.0, 1.0);

        // camera position rotated by car's heading
        let eyeX:number = xoffset + driverEyes[0] * Math.cos(heading);
        let eyeY:number = driverEyes[1];
        let eyeZ:number = zoffset - driverEyes[0] * Math.sin(heading);

        // set up camera
        lookAtMatrix = lookAt(new vec4(eyeX, eyeY, eyeZ, 1),
            new vec4(xoffset, 0, zoffset, 1),
            new vec4(0, 1, 0, 0));
    }

    // move car
    let mv:mat4 = lookAtMatrix;
    mv = mv.mult(translate(xoffset, 0.0, zoffset));
    mv = mv.mult(rotateY(heading * 180.0 / Math.PI));
    gl.uniformMatrix4fv(umv, false, mv.flatten());

    // draw car body
    gl.bindBuffer(gl.ARRAY_BUFFER, bufferId);
    gl.vertexAttribPointer(vPosition, 4, gl.FLOAT, false, 48, 0);
    gl.enableVertexAttribArray(vPosition);
    vNormal = gl.getAttribLocation(program, "vNormal");
    gl.vertexAttribPointer(vNormal, 4, gl.FLOAT, false, 48, 16);
    gl.enableVertexAttribArray(vNormal);
    gl.vertexAttribPointer(vColor, 4, gl.FLOAT, false, 48, 32);
    gl.enableVertexAttribArray(vColor);
    gl.drawArrays(gl.TRIANGLES, 0, carverts);    // draw the car body

    // draw driver
    mv = lookAtMatrix

    mv = mv.mult(translate(xoffset, 0.0, zoffset));
    mv = mv.mult(rotateY(heading * 180.0 / Math.PI));

    // this translation is necessary for the rotation because I
    // initially defined the driver's head at a point on the
    // car instead of at the origin
    mv = mv.mult(translate(-1.0, -0.8, 0.0));
    mv = mv.mult(rotateY(headRot));
    mv = mv.mult(translate(1.0, 0.8, 0.0));

    gl.uniformMatrix4fv(umv, false, mv.flatten());
    gl.drawArrays(gl.TRIANGLES, carverts, driververts);    // draw the driver

    // add ground
    mv = lookAtMatrix
    gl.uniformMatrix4fv(umv, false, mv.flatten());
    gl.drawArrays(gl.TRIANGLES, carverts + driververts, groundverts);    // draw the ground

    // add building
    mv = lookAtMatrix
    mv = mv.mult(translate(-10.0, -0.5, -10.0));
    gl.uniformMatrix4fv(umv, false, mv.flatten());
    gl.drawArrays(gl.TRIANGLES, carverts + driververts + groundverts, buildingverts);

    // add building
    mv = lookAtMatrix
    mv = mv.mult(translate(10.0, -0.5, -10.0));
    gl.uniformMatrix4fv(umv, false, mv.flatten());
    gl.drawArrays(gl.TRIANGLES, carverts + driververts + groundverts, buildingverts);

    // add building
    mv = lookAtMatrix
    mv = mv.mult(translate(-10.0, -0.5, 10.0));
    gl.uniformMatrix4fv(umv, false, mv.flatten());
    gl.drawArrays(gl.TRIANGLES, carverts + driververts + groundverts, buildingverts);

    // add building
    mv = lookAtMatrix
    mv = mv.mult(translate(10.0, -0.5, 10.0));
    gl.uniformMatrix4fv(umv, false, mv.flatten());
    gl.drawArrays(gl.TRIANGLES, carverts + driververts + groundverts, buildingverts);

    // add front left wheel
    mv = lookAtMatrix
    mv = mv.mult(translate(xoffset, 0.0, zoffset));
    mv = mv.mult(rotateY(heading * 180.0 / Math.PI));
    mv = mv.mult(translate(-1.5, 0.0, 0.5));
    mv = mv.mult(rotateY(yrot));
    mv = mv.mult(rotateZ(zrot));
    mv = mv.mult(rotateX(90.0));
    gl.uniformMatrix4fv(umv, false, mv.flatten());
    gl.drawArrays(gl.TRIANGLES, carverts + driververts + groundverts + buildingverts, wheelverts);    // draw the wheel

    // add front right wheel
    mv = lookAtMatrix
    mv = mv.mult(translate(xoffset, 0.0, zoffset));
    mv = mv.mult(rotateY(heading * 180.0 / Math.PI));
    mv = mv.mult(translate(-1.5, 0.0, -0.5));
    mv = mv.mult(rotateY(yrot));
    mv = mv.mult(rotateZ(zrot));
    mv = mv.mult(rotateX(90.0));
    gl.uniformMatrix4fv(umv, false, mv.flatten());
    gl.drawArrays(gl.TRIANGLES, carverts + driververts + groundverts + buildingverts, wheelverts);    // draw the wheel

    // add back left wheel
    mv = lookAtMatrix
    mv = mv.mult(translate(xoffset, 0.0, zoffset));
    mv = mv.mult(rotateY(heading * 180.0 / Math.PI));
    mv = mv.mult(translate(1.5, 0.0, 0.5));
    mv = mv.mult(rotateZ(zrot));
    mv = mv.mult(rotateX(90.0));
    gl.uniformMatrix4fv(umv, false, mv.flatten());
    gl.drawArrays(gl.TRIANGLES, carverts + driververts + groundverts + buildingverts, wheelverts);    // draw the wheel

    // add back right wheel
    mv = lookAtMatrix
    mv = mv.mult(translate(xoffset, 0.0, zoffset));
    mv = mv.mult(rotateY(heading * 180.0 / Math.PI));
    mv = mv.mult(translate(1.5, 0.0, -0.5));
    mv = mv.mult(rotateZ(zrot));
    mv = mv.mult(rotateX(90.0));
    gl.uniformMatrix4fv(umv, false, mv.flatten());
    gl.drawArrays(gl.TRIANGLES, carverts + driververts + groundverts + buildingverts, wheelverts);    // draw the wheel

    // add left headlight
    mv = lookAtMatrix
    mv = mv.mult(translate(xoffset, 0.0, zoffset));
    mv = mv.mult(rotateY(heading * 180.0 / Math.PI));
    mv = mv.mult(translate(-1.55, 0.0, -0.3));
    mv = mv.mult(rotateZ(90.0));
    gl.uniformMatrix4fv(umv, false, mv.flatten());
    gl.drawArrays(gl.TRIANGLES, carverts + driververts + groundverts + buildingverts + wheelverts, headlightverts);    // draw the headlight

    // set left headlight values
    // define light's position and direction in model space
    let localPos:vec4 = new vec4(0.0, 0.05, 0.0, 1.0);
    let localDir:vec4 = new vec4(0.0, 1.0, 0.0, 0.0);
    // get eye space position of light by applying same transformation matrix
    let eyePos:vec4 = mv.mult(localPos);
    // get eye space of direction of light by applying the same rotation transformations above
    mv = lookAtMatrix
    mv = mv.mult(rotateY(heading * 180.0 / Math.PI));
    mv = mv.mult(rotateZ(90.0));
    let eyeDir:vec4 = mv.mult(localDir);
    // send data to shader
    gl.uniform4fv(lightPosition[1], eyePos.flatten());
    gl.uniform4fv(lightColor[1], [1.0, 1.0, 1.0, 1.0]);
    gl.uniform4fv(lightDirection[1], eyeDir.flatten());
    gl.uniform1i(on_off[1], lightSwitches[1] ? 1 : 0);

    // add right headlight
    mv = lookAtMatrix
    mv = mv.mult(translate(xoffset, 0.0, zoffset));
    mv = mv.mult(rotateY(heading * 180.0 / Math.PI));
    mv = mv.mult(translate(-1.55, 0.0, 0.3));
    mv = mv.mult(rotateZ(90.0));
    gl.uniformMatrix4fv(umv, false, mv.flatten());
    gl.drawArrays(gl.TRIANGLES, carverts + driververts + groundverts + buildingverts + wheelverts, headlightverts);    // draw the headlight

    // set right headlight values
    // define light's position in model space
    localPos = new vec4(0.0, 0.05, 0.0, 1.0);
    // get eye space position of light by applying same transformation matrix
    eyePos = mv.mult(localPos);
    // send data to shader
    gl.uniform4fv(lightPosition[2], eyePos.flatten());
    gl.uniform4fv(lightColor[2], [1.0, 1.0, 1.0, 1.0]);
    gl.uniform4fv(lightDirection[2], eyeDir.flatten());
    gl.uniform1i(on_off[2], lightSwitches[1] ? 1 : 0);

    // add box for emergency lights
    mv = lookAtMatrix;
    mv = mv.mult(translate(xoffset, 0.0, zoffset));
    mv = mv.mult(rotateY(heading * 180.0 / Math.PI));
    mv = mv.mult(rotateY(boxSpin));
    mv = mv.mult(translate(0.0, 0.7, 0.0));
    gl.uniformMatrix4fv(umv, false, mv.flatten());
    gl.drawArrays(gl.TRIANGLES, carverts + driververts + groundverts + buildingverts + wheelverts + headlightverts, emergencyboxverts);    // draw the box

    // add white circles for emergency light "light bulbs"
    // add left bulb
    mv = lookAtMatrix;
    mv = mv.mult(translate(xoffset, 0.0, zoffset));
    mv = mv.mult(rotateY(heading * 180.0 / Math.PI));
    mv = mv.mult(rotateY(boxSpin));
    mv = mv.mult(translate(0.0, 0.7, 0.205));
    mv = mv.mult(rotateX(90.0));
    gl.uniformMatrix4fv(umv, false, mv.flatten());
    gl.drawArrays(gl.TRIANGLES, carverts + driververts + groundverts + buildingverts + wheelverts, headlightverts);    // draw the bulb

    // add blue light source
    // define light's position and direction in model space
    localPos = new vec4(0.0, 0.05, 0.0, 1.0);
    localDir = new vec4(0.0, 1.0, 0.0, 0.0);
    // get eye space position of light by applying same transformation matrix
    eyePos = mv.mult(localPos);
    // get eye space of direction of light by applying the same rotation transformations above
    mv = lookAtMatrix;
    mv = mv.mult(translate(xoffset, 0.0, zoffset));
    mv = mv.mult(rotateY(heading * 180.0 / Math.PI));
    mv = mv.mult(rotateY(boxSpin));
    mv = mv.mult(rotateX(90.0));
    eyeDir = mv.mult(localDir);
    // send data to shader
    gl.uniform4fv(lightPosition[3], eyePos.flatten());
    gl.uniform4fv(lightColor[3], [0.0, 0.0, 1.0, 1.0]);
    gl.uniform4fv(lightDirection[3], eyeDir.flatten());
    gl.uniform1i(on_off[3], lightSwitches[3] ? 1 : 0);

    // add right bulb
    mv = lookAtMatrix;
    mv = mv.mult(translate(xoffset, 0.0, zoffset));
    mv = mv.mult(rotateY(heading * 180.0 / Math.PI));
    mv = mv.mult(rotateY(boxSpin));
    mv = mv.mult(translate(0.0, 0.7, -0.205));
    mv = mv.mult(rotateX(90.0));
    gl.uniformMatrix4fv(umv, false, mv.flatten());
    gl.drawArrays(gl.TRIANGLES, carverts + driververts + groundverts + buildingverts + wheelverts, headlightverts);    // draw the bulb

    // add red light source
    // define light's position and direction in model space
    localPos = new vec4(0.0, -0.05, 0.0, 1.0);
    localDir = new vec4(0.0, -1.0, 0.0, 0.0);
    // get eye space position of light by applying same transformation matrix
    eyePos = mv.mult(localPos);
    // get eye space of direction of light by applying the same rotation transformations above
    mv = lookAtMatrix;
    mv = mv.mult(translate(xoffset, 0.0, zoffset));
    mv = mv.mult(rotateY(heading * 180.0 / Math.PI));
    mv = mv.mult(rotateY(boxSpin));
    mv = mv.mult(rotateX(90.0));
    eyeDir = mv.mult(localDir);
    // send data to shader
    gl.uniform4fv(lightPosition[4], eyePos.flatten());
    gl.uniform4fv(lightColor[4], [1.0, 0.0, 0.0, 1.0]);
    gl.uniform4fv(lightDirection[4], eyeDir.flatten());
    gl.uniform1i(on_off[4], lightSwitches[4] ? 1 : 0);

}
