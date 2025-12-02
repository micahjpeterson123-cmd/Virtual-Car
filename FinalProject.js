"use strict";
//it will be handy to have references to some of our WebGL related objects
let gl;
let canvas;
let program;
let bufferId;
let umv; // index of model_view in shader program
let uproj; // index of projection in shader program
let vPosition; // remember where this shader attribute is
let vColor; // remember where the color shader attribute is
let vNormal; // remember where the normal shader attribute is
let vSpecularColor; // remember where the specular color attribute is
let vSpecularExponent; // remember where the specular exponent attribute is
let ambient_light; // index of ambient_light in shader program
let cosTheta; // index of cos(30) in shader program
// create arrays for light uniforms
let NUM_LIGHTS;
// 0 = overhead light, 1 & 2 = car headlights
let lightPosition;
let lightColor;
let lightDirection;
let on_off;
let lightSwitches;
let xoffset; // translation x
let zoffset; // translation z
let xrot; // rotate around x-axis
let yrot; // rotate around y-axis
let zrot; // rotate around z-axis
let heading; // car's orientation angle in radians
let moveForward = false; // true when car is moving forward
let moveBackward = false; // true when car is moving backward
// vertex offsets for render function
let carverts;
let groundverts;
let buildingverts;
let wheelverts;
let headlightverts;
let updateInterval; // interval for frames per second
import { initShaders, vec4, flatten, perspective, translate, lookAt, rotateX, rotateY, rotateZ } from './helperfunctions.js';
//We want some set up to happen immediately when the page loads
window.onload = function init() {
    //fetch reference to the canvas element we defined in the html file
    canvas = document.getElementById("gl-canvas");
    //grab the WebGL 2 context for that canvas.  This is what we'll use to do our drawing
    gl = canvas.getContext('webgl2');
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
    // send over cos(30 degrees)
    cosTheta = gl.getUniformLocation(program, "cosTheta");
    gl.uniform1f(cosTheta, Math.cos(30.0 * Math.PI / 180.0));
    // initialize number of lights
    NUM_LIGHTS = 3;
    // fetch light uniforms and initialize light switches
    lightPosition = [];
    lightColor = [];
    lightDirection = [];
    on_off = [];
    lightSwitches = [];
    for (let i = 0; i < NUM_LIGHTS; i++) {
        // use template literals to loop through lights and retrieve each one
        lightPosition[i] = gl.getUniformLocation(program, `lightPosition[${i}]`);
        lightColor[i] = gl.getUniformLocation(program, `lightColor[${i}]`);
        lightDirection[i] = gl.getUniformLocation(program, `lightDirection[${i}]`);
        on_off[i] = gl.getUniformLocation(program, `on_off[${i}]`);
        lightSwitches[i] = true;
    }
    // initialize various animation parameters
    xoffset = zoffset = 0;
    xrot = yrot = zrot = heading = 0;
    if (updateInterval) {
        clearInterval(updateInterval);
    }
    // run at 60 frames per second
    updateInterval = window.setInterval(update, 16);
    //This will execute when the user hits a key
    window.addEventListener("keydown", function (event) {
        switch (event.key) {
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
                if (yrot > -50.0) {
                    yrot -= 5.0;
                }
                break;
            case "ArrowLeft": // turn car to the left
                if (yrot < 50.0) {
                    yrot += 5.0;
                }
                break;
            case "0": // toggle overhead light on and off
                lightSwitches[0] = !lightSwitches[0];
                gl.uniform1i(on_off[0], lightSwitches[0] ? 1 : 0);
                break;
            case "9": // toggle headlights on and off
                lightSwitches[1] = !lightSwitches[1];
                lightSwitches[2] = !lightSwitches[2];
                gl.uniform1i(on_off[1], lightSwitches[1] ? 1 : 0);
                gl.uniform1i(on_off[2], lightSwitches[2] ? 1 : 0);
                break;
        }
        requestAnimationFrame(render); //and now we need a new frame since we made a change
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
function makeCarGroundAndBuffer() {
    let points = []; //empty array
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
    points.push(new vec4(1.0, 0.0, 1.0, 1.0)); //magenta
    points.push(new vec4(1.5, 0.5, -0.5, 1.0));
    points.push(new vec4(0.0, 0.0, -1.0, 0.0)); //normal
    points.push(new vec4(1.0, 0.0, 1.0, 1.0)); //magenta
    points.push(new vec4(1.5, 0.5, -0.5, 1.0));
    points.push(new vec4(0.0, 0.0, -1.0, 0.0)); //normal
    points.push(new vec4(1.0, 0.0, 1.0, 1.0)); //magenta
    points.push(new vec4(1.5, -0.5, -0.5, 1.0));
    points.push(new vec4(0.0, 0.0, -1.0, 0.0)); //normal
    points.push(new vec4(1.0, 0.0, 1.0, 1.0)); //magenta
    points.push(new vec4(-1.5, -0.5, -0.5, 1.0));
    points.push(new vec4(0.0, 0.0, -1.0, 0.0)); //normal
    points.push(new vec4(1.0, 0.0, 1.0, 1.0)); //magenta
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
    groundverts = (points.length / 3) - carverts;
    // add a sphereical building (reference object) model
    let subdiv = 15;
    let r = 2.5;
    let step = (360.0 / subdiv) * (Math.PI / 180.0);
    for (let lat = 0; lat <= Math.PI; lat += step) { //latitude
        for (let lon = 0; lon + step <= 2 * Math.PI; lon += step) { //longitude
            //triangle 1
            points.push(new vec4(r * Math.sin(lat) * Math.sin(lon), r * Math.cos(lat), r * Math.cos(lon) * Math.sin(lat), 1.0));
            points.push(new vec4(r * Math.sin(lat) * Math.sin(lon), r * Math.cos(lat), r * Math.cos(lon) * Math.sin(lat), 0.0)); //normal
            points.push(new vec4(0.5, 0.5, 0.5, 1.0)); //gray
            points.push(new vec4(r * Math.sin(lat) * Math.sin(lon + step), r * Math.cos(lat), r * Math.sin(lat) * Math.cos(lon + step), 1.0));
            points.push(new vec4(r * Math.sin(lat) * Math.sin(lon + step), r * Math.cos(lat), r * Math.sin(lat) * Math.cos(lon + step), 0.0)); //normal
            points.push(new vec4(0.5, 0.5, 0.5, 1.0)); //gray
            points.push(new vec4(r * Math.sin(lat + step) * Math.sin(lon + step), r * Math.cos(lat + step), r * Math.cos(lon + step) * Math.sin(lat + step), 1.0));
            points.push(new vec4(r * Math.sin(lat + step) * Math.sin(lon + step), r * Math.cos(lat + step), r * Math.cos(lon + step) * Math.sin(lat + step), 0.0)); //normal
            points.push(new vec4(0.5, 0.5, 0.5, 1.0)); //gray
            //triangle 2
            points.push(new vec4(r * Math.sin(lat + step) * Math.sin(lon + step), r * Math.cos(lat + step), r * Math.cos(lon + step) * Math.sin(lat + step), 1.0));
            points.push(new vec4(r * Math.sin(lat + step) * Math.sin(lon + step), r * Math.cos(lat + step), r * Math.cos(lon + step) * Math.sin(lat + step), 0.0)); //normal
            points.push(new vec4(0.5, 0.5, 0.5, 1.0)); //gray
            points.push(new vec4(r * Math.sin(lat + step) * Math.sin(lon), r * Math.cos(lat + step), r * Math.sin(lat + step) * Math.cos(lon), 1.0));
            points.push(new vec4(r * Math.sin(lat + step) * Math.sin(lon), r * Math.cos(lat + step), r * Math.sin(lat + step) * Math.cos(lon), 0.0)); //normal
            points.push(new vec4(0.5, 0.5, 0.5, 1.0)); //gray
            points.push(new vec4(r * Math.sin(lat) * Math.sin(lon), r * Math.cos(lat), r * Math.cos(lon) * Math.sin(lat), 1.0));
            points.push(new vec4(r * Math.sin(lat) * Math.sin(lon), r * Math.cos(lat), r * Math.cos(lon) * Math.sin(lat), 0.0)); //normal
            points.push(new vec4(0.5, 0.5, 0.5, 1.0)); //gray
        }
    }
    buildingverts = (points.length / 3) - carverts - groundverts;
    // add a wheel to be drawn four times
    let angleStep = (2 * Math.PI) / 32;
    for (let i = 0; i < 32; i++) {
        let theta1 = i * angleStep;
        let theta2 = (i + 1) * angleStep;
        // outer rim of wheel vertex coordinates
        let x1 = 0.5 * Math.cos(theta1);
        let z1 = 0.5 * Math.sin(theta1);
        let x2 = 0.5 * Math.cos(theta2);
        let z2 = 0.5 * Math.sin(theta2);
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
        points.push(new vec4(1, i / 32.0, i / 32.0, 1.0)); // red shade
        points.push(new vec4(x2, -0.05, z2, 1.0));
        points.push(new vec4(0.0, -1.0, 0.0, 0.0)); // normal
        points.push(new vec4(1, i / 32.0, i / 32.0, 1.0)); // red shade
        points.push(new vec4(x1, -0.05, z1, 1.0));
        points.push(new vec4(0.0, -1.0, 0.0, 0.0)); // normal
        points.push(new vec4(1, i / 32.0, i / 32.0, 1.0)); // red shade
        // top circle
        points.push(new vec4(0, 0.05, 0, 1.0));
        points.push(new vec4(0.0, 1.0, 0.0, 0.0)); // normal
        points.push(new vec4(1, i / 32.0, i / 32.0, 1.0)); // red shade
        points.push(new vec4(x1, 0.05, z1, 1.0));
        points.push(new vec4(0.0, 1.0, 0.0, 0.0)); // normal
        points.push(new vec4(1, i / 32.0, i / 32.0, 1.0)); // red shade
        points.push(new vec4(x2, 0.05, z2, 1.0));
        points.push(new vec4(0.0, 1.0, 0.0, 0.0)); // normal
        points.push(new vec4(1, i / 32.0, i / 32.0, 1.0)); // red shade
    }
    wheelverts = (points.length / 3) - carverts - groundverts - buildingverts;
    // add headlight circle to be drawn twice
    for (let i = 0; i < 32; i++) {
        let theta1 = i * angleStep;
        let theta2 = (i + 1) * angleStep;
        // outer rim of circle coordinates
        let x1 = 0.1 * Math.cos(theta1);
        let z1 = 0.1 * Math.sin(theta1);
        let x2 = 0.1 * Math.cos(theta2);
        let z2 = 0.1 * Math.sin(theta2);
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
    headlightverts = (points.length / 3) - carverts - groundverts - buildingverts - wheelverts;
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
function update() {
    // steer the wheels by this amount in radians
    const steer = (yrot / 2.0) * Math.PI / 180.0;
    // the speed of the car
    const speed = 0.05;
    if (moveForward) {
        zrot += 2.0;
        // rate of rotation of car is proportional to
        // tan(steer) / wheelbase (wheelbase = 2.0)
        heading += speed * Math.tan(steer) / 2.0;
        xoffset -= speed * Math.cos(heading);
        zoffset += speed * Math.sin(heading);
    }
    else if (moveBackward) {
        zrot -= 2.0;
        heading -= speed * Math.tan(steer) * 0.5;
        xoffset += speed * Math.cos(heading);
        zoffset -= speed * Math.sin(heading);
    }
    // stop car if it reaches the edge of the map
    if (xoffset >= 50.0 || xoffset <= -50.0 || zoffset >= 50.0 || zoffset <= -50.0) {
        moveForward = false;
        moveBackward = false;
    }
    requestAnimationFrame(render);
}
//draw a new frame
function render() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    // set values for lights
    gl.vertexAttrib4fv(vSpecularColor, [1.0, 1.0, 1.0, 1.0]);
    gl.vertexAttrib1f(vSpecularExponent, 5.0);
    gl.uniform4fv(ambient_light, [0.3, 0.3, 0.3, 1]);
    // overhead light values
    gl.uniform4fv(lightPosition[0], [0, 50, 0, 1]);
    gl.uniform4fv(lightColor[0], [1, 1, 1, 1]);
    gl.uniform1i(on_off[0], lightSwitches[0] ? 1 : 0);
    let p = perspective(45.0, canvas.clientWidth / canvas.clientHeight, 1.0, 100.0);
    gl.uniformMatrix4fv(uproj, false, p.flatten());
    let lookAtMatrix;
    // chase camera
    // camera's location in car-local coordinates
    let driverEyes = new vec4(7.5, 1.5, 0.0, 1.0);
    // camera position rotated by car's heading
    let eyeX = xoffset + driverEyes[0] * Math.cos(heading);
    let eyeY = driverEyes[1];
    let eyeZ = zoffset - driverEyes[0] * Math.sin(heading);
    // set up camera
    lookAtMatrix = lookAt(new vec4(eyeX, eyeY, eyeZ, 1), new vec4(xoffset, 0, zoffset, 1), new vec4(0, 1, 0, 0));
    // move car
    let mv = lookAtMatrix;
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
    gl.drawArrays(gl.TRIANGLES, 0, carverts); // draw the car body
    // add ground
    mv = lookAtMatrix;
    gl.uniformMatrix4fv(umv, false, mv.flatten());
    gl.drawArrays(gl.TRIANGLES, carverts, groundverts); // draw the ground
    // add building
    mv = lookAtMatrix;
    mv = mv.mult(translate(-10.0, -0.5, -10.0));
    gl.uniformMatrix4fv(umv, false, mv.flatten());
    gl.drawArrays(gl.TRIANGLES, carverts + groundverts, buildingverts);
    // add building
    mv = lookAtMatrix;
    mv = mv.mult(translate(10.0, -0.5, -10.0));
    gl.uniformMatrix4fv(umv, false, mv.flatten());
    gl.drawArrays(gl.TRIANGLES, carverts + groundverts, buildingverts);
    // add building
    mv = lookAtMatrix;
    mv = mv.mult(translate(-10.0, -0.5, 10.0));
    gl.uniformMatrix4fv(umv, false, mv.flatten());
    gl.drawArrays(gl.TRIANGLES, carverts + groundverts, buildingverts);
    // add building
    mv = lookAtMatrix;
    mv = mv.mult(translate(10.0, -0.5, 10.0));
    gl.uniformMatrix4fv(umv, false, mv.flatten());
    gl.drawArrays(gl.TRIANGLES, carverts + groundverts, buildingverts);
    // add front left wheel
    mv = lookAtMatrix;
    mv = mv.mult(translate(xoffset, 0.0, zoffset));
    mv = mv.mult(rotateY(heading * 180.0 / Math.PI));
    mv = mv.mult(translate(-1.5, 0.0, 0.5));
    mv = mv.mult(rotateY(yrot));
    mv = mv.mult(rotateZ(zrot));
    mv = mv.mult(rotateX(90.0));
    gl.uniformMatrix4fv(umv, false, mv.flatten());
    gl.drawArrays(gl.TRIANGLES, carverts + groundverts + buildingverts, wheelverts); // draw the wheel
    // add front right wheel
    mv = lookAtMatrix;
    mv = mv.mult(translate(xoffset, 0.0, zoffset));
    mv = mv.mult(rotateY(heading * 180.0 / Math.PI));
    mv = mv.mult(translate(-1.5, 0.0, -0.5));
    mv = mv.mult(rotateY(yrot));
    mv = mv.mult(rotateZ(zrot));
    mv = mv.mult(rotateX(90.0));
    gl.uniformMatrix4fv(umv, false, mv.flatten());
    gl.drawArrays(gl.TRIANGLES, carverts + groundverts + buildingverts, wheelverts); // draw the wheel
    // add back left wheel
    mv = lookAtMatrix;
    mv = mv.mult(translate(xoffset, 0.0, zoffset));
    mv = mv.mult(rotateY(heading * 180.0 / Math.PI));
    mv = mv.mult(translate(1.5, 0.0, 0.5));
    mv = mv.mult(rotateZ(zrot));
    mv = mv.mult(rotateX(90.0));
    gl.uniformMatrix4fv(umv, false, mv.flatten());
    gl.drawArrays(gl.TRIANGLES, carverts + groundverts + buildingverts, wheelverts); // draw the wheel
    // add back right wheel
    mv = lookAtMatrix;
    mv = mv.mult(translate(xoffset, 0.0, zoffset));
    mv = mv.mult(rotateY(heading * 180.0 / Math.PI));
    mv = mv.mult(translate(1.5, 0.0, -0.5));
    mv = mv.mult(rotateZ(zrot));
    mv = mv.mult(rotateX(90.0));
    gl.uniformMatrix4fv(umv, false, mv.flatten());
    gl.drawArrays(gl.TRIANGLES, carverts + groundverts + buildingverts, wheelverts); // draw the wheel
    // add left headlight
    mv = lookAtMatrix;
    mv = mv.mult(translate(xoffset, 0.0, zoffset));
    mv = mv.mult(rotateY(heading * 180.0 / Math.PI));
    mv = mv.mult(translate(-1.55, 0.0, -0.3));
    mv = mv.mult(rotateZ(90.0));
    gl.uniformMatrix4fv(umv, false, mv.flatten());
    gl.drawArrays(gl.TRIANGLES, carverts + groundverts + buildingverts + wheelverts, headlightverts); // draw the headlight
    // set left headlight values
    // define light's position and direction in model space
    let localPos = new vec4(0.0, 0.05, 0.0, 1.0);
    let localDir = new vec4(0.0, 1.0, 0.0, 0.0);
    // get eye space position of light by applying same transformation matrix
    let eyePos = mv.mult(localPos);
    // get eye space of direction of light by applying the same rotation transformations above
    mv = lookAtMatrix;
    mv = mv.mult(rotateY(heading * 180.0 / Math.PI));
    mv = mv.mult(rotateZ(90.0));
    let eyeDir = mv.mult(localDir);
    // send data to shader
    gl.uniform4fv(lightPosition[1], eyePos.flatten());
    gl.uniform4fv(lightColor[1], [1.0, 1.0, 1.0, 1.0]);
    gl.uniform4fv(lightDirection[1], eyeDir.flatten());
    gl.uniform1i(on_off[1], lightSwitches[1] ? 1 : 0);
    // add right headlight
    mv = lookAtMatrix;
    mv = mv.mult(translate(xoffset, 0.0, zoffset));
    mv = mv.mult(rotateY(heading * 180.0 / Math.PI));
    mv = mv.mult(translate(-1.55, 0.0, 0.3));
    mv = mv.mult(rotateZ(90.0));
    gl.uniformMatrix4fv(umv, false, mv.flatten());
    gl.drawArrays(gl.TRIANGLES, carverts + groundverts + buildingverts + wheelverts, headlightverts); // draw the headlight
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
    // send data to shader
    gl.uniform4fv(lightPosition[3], eyePos.flatten());
    gl.uniform4fv(lightColor[3], [0.0, 0.0, 1.0, 1.0]);
    gl.uniform4fv(lightDirection[3], eyeDir.flatten());
    gl.uniform1i(on_off[3], lightSwitches[3] ? 1 : 0);
}
