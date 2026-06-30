"use strict";
//it will be handy to have references to some of our WebGL related objects
let gl;
let canvas;
let program;
let bufferId;
// skybox globals
let skyboxProgram;
let skyboxId;
let skyboxTexture;
let uSkyboxSampler;
let vSkyPosition; // remember where the sky position attribute is
// env cubemap globals
let semisphereProgram;
let envCubemap;
let envFBO;
let envDepthRB;
let envMapSize = 256;
const CUBE_DIRECTIONS = [
    { target: [1, 0, 0], up: [0, -1, 0] }, // +X
    { target: [-1, 0, 0], up: [0, -1, 0] }, // -X
    { target: [0, 1, 0], up: [0, 0, 1] }, // +Y
    { target: [0, -1, 0], up: [0, 0, -1] }, // -Y
    { target: [0, 0, 1], up: [0, -1, 0] }, // +Z
    { target: [0, 0, -1], up: [0, -1, 0] }, // -Z
];
let uEnvCubemapSampler;
// glass semisphere globals
let semisphereId;
let semisphereVertCount;
let vSemispherePosition;
let vSemisphereNormal;
let mode;
// matrix uniform locations
let umv;
let uproj;
let uSkyView;
let uSkyProj;
let uSemisphereModel;
let uSemisphereView;
let uSemisphereProj;
// car and scene globals
let vPosition;
let vColor;
let vNormal;
let vSpecularColor;
let vSpecularExponent;
let ambient_light;
let cosTheta; // index of cos(30) in shader program
let eta; // index of refractive index ratio in semisphere shader program
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
let yrot; // rotate around y-axis
let zrot; // rotate around z-axis
let heading; // car's orientation angle in radians
let moveForward = false; // true when car is moving forward
let moveBackward = false; // true when car is moving backward
// vertex offsets
let carverts;
let groundverts;
let buildingverts;
let wheelverts;
let headlightverts;
let tallbuildingverts;
let updateInterval; // interval for frames per second
import { initFileShaders, vec4, flatten, perspective, translate, lookAt, rotateX, rotateY, rotateZ } from './helperfunctions.js';
window.onload = function init() {
    // fetch reference to the canvas element we defined in the html file
    canvas = document.getElementById("gl-canvas");
    // grab the WebGL 2 context for that canvas
    gl = canvas.getContext('webgl2');
    if (!gl) {
        alert("WebGL isn't available");
    }
    // take the vertex and fragment shaders and compile them into shader programs
    program = initFileShaders(gl, "vShader.glsl", "fShader.glsl");
    skyboxProgram = initFileShaders(gl, "vShaderSkybox.glsl", "fShaderSkybox.glsl");
    semisphereProgram = initFileShaders(gl, "vShaderSemisphere.glsl", "fShaderSemisphere.glsl");
    gl.useProgram(program);
    // fetch matrix uniforms
    umv = gl.getUniformLocation(program, "model_view");
    uproj = gl.getUniformLocation(program, "projection");
    uSkyView = gl.getUniformLocation(skyboxProgram, "uView");
    uSkyProj = gl.getUniformLocation(skyboxProgram, "uProjection");
    uSemisphereModel = gl.getUniformLocation(semisphereProgram, "uSemisphereModel");
    uSemisphereView = gl.getUniformLocation(semisphereProgram, "uSemisphereView");
    uSemisphereProj = gl.getUniformLocation(semisphereProgram, "uSemisphereProjection");
    // fetch texture samplers
    uSkyboxSampler = gl.getUniformLocation(skyboxProgram, "uSkyboxSampler");
    uEnvCubemapSampler = gl.getUniformLocation(semisphereProgram, "uEnvCubemapSampler");
    // fetch attributes
    vPosition = gl.getAttribLocation(program, "vPosition");
    vNormal = gl.getAttribLocation(program, "vNormal");
    vColor = gl.getAttribLocation(program, "vColor");
    vSpecularColor = gl.getAttribLocation(program, "vSpecularColor");
    vSpecularExponent = gl.getAttribLocation(program, "vSpecularExponent");
    vSkyPosition = gl.getAttribLocation(skyboxProgram, "vSkyPosition");
    vSemispherePosition = gl.getAttribLocation(semisphereProgram, "vSemispherePosition");
    vSemisphereNormal = gl.getAttribLocation(semisphereProgram, "vSemisphereNormal");
    // fetch light uniforms
    ambient_light = gl.getUniformLocation(program, "ambient_light");
    // send over cos(30 degrees)
    cosTheta = gl.getUniformLocation(program, "cosTheta");
    gl.uniform1f(cosTheta, Math.cos(30.0 * Math.PI / 180.0));
    gl.useProgram(semisphereProgram);
    // mode: 1 = refraction, 2 = reflection
    mode = gl.getUniformLocation(semisphereProgram, "mode");
    // default to refraction + reflection
    gl.uniform1i(mode, 1);
    // send over refractive index ratio (1.0 / 1.5) to semisphereProgram
    eta = gl.getUniformLocation(semisphereProgram, "eta");
    // 0.0 actually looks much better?
    gl.uniform1f(eta, 0.0);
    gl.useProgram(program);
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
    // disable headlights (For some reason, generating the cubemap from the perspective
    // of the center of the glass semisphere completely breaks the headlight light source behavior.
    // However, when the cubemap is generated from the perspective of the chase camera, the
    // headlights work completely fine. I have tried to figure out why this is for hours and
    // have gotten nowhere. If you can figure out what is happening, be my guest.)
    lightSwitches[1] = lightSwitches[2] = false;
    // initialize various animation parameters
    xoffset = zoffset = 0;
    yrot = zrot = heading = 0;
    // initialize env cubemap
    const env = createEnvironmentCubemap(gl, envMapSize);
    envCubemap = env.texture;
    envFBO = env.framebuffer;
    envDepthRB = env.depth;
    // run at 60 fps
    if (updateInterval) {
        clearInterval(updateInterval);
    }
    updateInterval = window.setInterval(update, 16);
    // keyboard listener
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
            case "1": // make semisphere do refraction
                gl.useProgram(semisphereProgram);
                gl.uniform1i(mode, 1);
                gl.useProgram(program);
                break;
            case "2": // make semisphere do reflection
                gl.useProgram(semisphereProgram);
                gl.uniform1i(mode, 2);
                gl.useProgram(program);
                break;
            // case "3": // combine refraction with reflection
            //     gl.useProgram(semisphereProgram);
            //     gl.uniform1i(mode, 3);
            //     gl.useProgram(program);
            //     break;
        }
        requestAnimationFrame(render);
    });
    // generate skybox
    makeSkyboxAndBuffer();
    // generate all the objects (except semisphere)
    makeCarGroundAndBuffer();
    // generate semisphere
    generateSemisphere(360);
    // draw to the whole canvas
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    // set void color to black
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    // avoid having objects that are behind other objects show up anyway
    gl.enable(gl.DEPTH_TEST);
};
// generate skybox cubemap using filepath strings of image files
function loadSkyboxCubemap(gl, paths) {
    // create cubemap texture
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);
    // establish targets
    const targets = [
        gl.TEXTURE_CUBE_MAP_POSITIVE_X,
        gl.TEXTURE_CUBE_MAP_NEGATIVE_X,
        gl.TEXTURE_CUBE_MAP_POSITIVE_Y,
        gl.TEXTURE_CUBE_MAP_NEGATIVE_Y,
        gl.TEXTURE_CUBE_MAP_POSITIVE_Z,
        gl.TEXTURE_CUBE_MAP_NEGATIVE_Z
    ];
    // attach images to cubemap, then apply texture filters after all images are fully loaded
    let loadedImages = 0;
    for (let i = 0; i < 6; i++) {
        const image = new Image();
        image.src = paths[i];
        image.onload = () => {
            gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);
            gl.texImage2D(targets[i], 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
            loadedImages++;
            if (loadedImages === 6) {
                gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
                gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
                gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
                gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            }
        };
    }
    return texture;
}
// create skybox
function makeSkyboxAndBuffer() {
    // create skybox texture
    skyboxTexture = loadSkyboxCubemap(gl, [
        "px.png", "nx.png",
        "py.png", "ny.png",
        "pz.png", "nz.png"
    ]);
    // create skybox vertex list
    const skyboxVertices = new Float32Array([
        // front
        -1, -1, 1,
        1, -1, 1,
        -1, 1, 1,
        -1, 1, 1,
        1, -1, 1,
        1, 1, 1,
        // back
        -1, -1, -1,
        -1, 1, -1,
        1, -1, -1,
        1, -1, -1,
        -1, 1, -1,
        1, 1, -1,
        // top
        -1, 1, -1,
        -1, 1, 1,
        1, 1, -1,
        1, 1, -1,
        -1, 1, 1,
        1, 1, 1,
        // bottom
        -1, -1, -1,
        1, -1, -1,
        -1, -1, 1,
        -1, -1, 1,
        1, -1, -1,
        1, -1, 1,
        // right
        1, -1, -1,
        1, 1, -1,
        1, -1, 1,
        1, -1, 1,
        1, 1, -1,
        1, 1, 1,
        // left
        -1, -1, -1,
        -1, -1, 1,
        -1, 1, -1,
        -1, 1, -1,
        -1, -1, 1,
        -1, 1, 1
    ]);
    // create buffer
    skyboxId = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, skyboxId);
    // send skyboxVertices to graphics card
    gl.bufferData(gl.ARRAY_BUFFER, skyboxVertices, gl.STATIC_DRAW);
    gl.vertexAttribPointer(vSkyPosition, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vSkyPosition);
}
// create env cubemap
// allocates an empty cubemap for renderEnvironmentCubemapFull() to populate
function createEnvironmentCubemap(gl, size) {
    // create cubemap texture
    const tx = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, tx);
    // allocate each face
    for (let i = 0; i < 6; i++) {
        gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X + i, 0, gl.RGBA, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    }
    // apply texture filters
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
    // create framebuffer and depth renderbuffer
    const fb = gl.createFramebuffer();
    const rb = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, rb);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, size, size);
    // unbind everything
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindRenderbuffer(gl.RENDERBUFFER, null);
    return { texture: tx, framebuffer: fb, depth: rb };
}
// render env cubemap
function renderEnvironmentCubemapFull() {
    // center of semisphere
    const center = new vec4(xoffset, 0.6, zoffset, 1.0);
    // 90 degree fov, aspect ratio 1.0, to get square image
    const proj = perspective(90, 1.0, 0.1, 500.0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, envFBO);
    gl.bindRenderbuffer(gl.RENDERBUFFER, envDepthRB);
    // set renderbuffer as depth attachment
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, envDepthRB);
    // establish targets
    const targets = [
        gl.TEXTURE_CUBE_MAP_POSITIVE_X,
        gl.TEXTURE_CUBE_MAP_NEGATIVE_X,
        gl.TEXTURE_CUBE_MAP_POSITIVE_Y,
        gl.TEXTURE_CUBE_MAP_NEGATIVE_Y,
        gl.TEXTURE_CUBE_MAP_POSITIVE_Z,
        gl.TEXTURE_CUBE_MAP_NEGATIVE_Z,
    ];
    for (let face = 0; face < 6; face++) {
        // attach current face as color attachment
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, targets[face], envCubemap, 0);
        // set viewport to cubemap face size
        gl.viewport(0, 0, envMapSize, envMapSize);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        // compute view for this face
        const dir = CUBE_DIRECTIONS[face].target;
        const up = CUBE_DIRECTIONS[face].up;
        const lookTarget = [center[0] + dir[0], center[1] + dir[1], center[2] + dir[2]];
        const view = lookAt(new vec4(center[0], center[1], center[2], 1.0), new vec4(lookTarget[0], lookTarget[1], lookTarget[2], 1.0), new vec4(up[0], up[1], up[2], 0.0));
        // pass projection and view to shader
        gl.useProgram(program);
        gl.uniformMatrix4fv(uproj, false, proj.flatten()); // projection for cubemap face
        gl.uniformMatrix4fv(umv, false, view.flatten()); // view as model_view for scene
        // draw scene objects from the perspective of the center of the semisphere, but skip the semisphere (otherwise it appears in itself)
        drawSceneObjects(view, proj, true); // pass true to exclude semisphere object
    }
    // generate mipmaps
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, envCubemap);
    gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
    // restore default framebuffer and viewport
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
}
// make all of the objects (except semisphere) and send them over to the graphics card
function makeCarGroundAndBuffer() {
    let points = []; // empty array
    // push order: position, normal, color
    // add car body
    // left face
    points.push(new vec4(1.5, -0.5, 0.5, 1.0));
    points.push(new vec4(0.0, 0.0, 1.0, 0.0)); // normal
    points.push(new vec4(0.0, 1.0, 1.0, 1.0)); // cyan
    points.push(new vec4(1.5, 0.5, 0.5, 1.0));
    points.push(new vec4(0.0, 0.0, 1.0, 0.0)); // normal
    points.push(new vec4(0.0, 1.0, 1.0, 1.0)); // cyan
    points.push(new vec4(-1.5, 0.5, 0.5, 1.0));
    points.push(new vec4(0.0, 0.0, 1.0, 0.0)); // normal
    points.push(new vec4(0.0, 1.0, 1.0, 1.0)); // cyan
    points.push(new vec4(-1.5, 0.5, 0.5, 1.0));
    points.push(new vec4(0.0, 0.0, 1.0, 0.0)); // normal
    points.push(new vec4(0.0, 1.0, 1.0, 1.0)); // cyan
    points.push(new vec4(-1.5, -0.5, 0.5, 1.0));
    points.push(new vec4(0.0, 0.0, 1.0, 0.0)); // normal
    points.push(new vec4(0.0, 1.0, 1.0, 1.0)); // cyan
    points.push(new vec4(1.5, -0.5, 0.5, 1.0));
    points.push(new vec4(0.0, 0.0, 1.0, 0.0)); // normal
    points.push(new vec4(0.0, 1.0, 1.0, 1.0)); // cyan
    // right face
    points.push(new vec4(-1.5, -0.5, -0.5, 1.0));
    points.push(new vec4(0.0, 0.0, -1.0, 0.0)); // normal
    points.push(new vec4(1.0, 0.0, 1.0, 1.0)); // magenta
    points.push(new vec4(-1.5, 0.5, -0.5, 1.0));
    points.push(new vec4(0.0, 0.0, -1.0, 0.0)); // normal
    points.push(new vec4(1.0, 0.0, 1.0, 1.0)); // magenta
    points.push(new vec4(1.5, 0.5, -0.5, 1.0));
    points.push(new vec4(0.0, 0.0, -1.0, 0.0)); // normal
    points.push(new vec4(1.0, 0.0, 1.0, 1.0)); // magenta
    points.push(new vec4(1.5, 0.5, -0.5, 1.0));
    points.push(new vec4(0.0, 0.0, -1.0, 0.0)); // normal
    points.push(new vec4(1.0, 0.0, 1.0, 1.0)); // magenta
    points.push(new vec4(1.5, -0.5, -0.5, 1.0));
    points.push(new vec4(0.0, 0.0, -1.0, 0.0)); // normal
    points.push(new vec4(1.0, 0.0, 1.0, 1.0)); // magenta
    points.push(new vec4(-1.5, -0.5, -0.5, 1.0));
    points.push(new vec4(0.0, 0.0, -1.0, 0.0)); // normal
    points.push(new vec4(1.0, 0.0, 1.0, 1.0)); // magenta
    // back face
    points.push(new vec4(1.5, 0.5, 0.5, 1.0));
    points.push(new vec4(1.0, 0.0, 0.0, 0.0)); // normal
    points.push(new vec4(1.5, 1.0, 0.0, 1.0)); // yellow
    points.push(new vec4(1.5, -0.5, 0.5, 1.0));
    points.push(new vec4(1.0, 0.0, 0.0, 0.0)); // normal
    points.push(new vec4(1.5, 1.0, 0.0, 1.0)); // yellow
    points.push(new vec4(1.5, -0.5, -0.5, 1.0));
    points.push(new vec4(1.0, 0.0, 0.0, 0.0)); // normal
    points.push(new vec4(1.5, 1.0, 0.0, 1.0)); // yellow
    points.push(new vec4(1.5, -0.5, -0.5, 1.0));
    points.push(new vec4(1.0, 0.0, 0.0, 0.0)); // normal
    points.push(new vec4(1.5, 1.0, 0.0, 1.0)); // yellow
    points.push(new vec4(1.5, 0.5, -0.5, 1.0));
    points.push(new vec4(1.0, 0.0, 0.0, 0.0)); // normal
    points.push(new vec4(1.5, 1.0, 0.0, 1.0)); // yellow
    points.push(new vec4(1.5, 0.5, 0.5, 1.0));
    points.push(new vec4(1.0, 0.0, 0.0, 0.0)); // normal
    points.push(new vec4(1.5, 1.0, 0.0, 1.0)); // yellow
    // front face
    points.push(new vec4(-1.5, 0.5, -0.5, 1.0));
    points.push(new vec4(-1.0, 0.0, 0.0, 0.0)); // normal
    points.push(new vec4(1.0, 0.0, 0.0, 1.0)); // red
    points.push(new vec4(-1.5, -0.5, -0.5, 1.0));
    points.push(new vec4(-1.0, 0.0, 0.0, 0.0)); // normal
    points.push(new vec4(1.0, 0.0, 0.0, 1.0)); // red
    points.push(new vec4(-1.5, -0.5, 0.5, 1.0));
    points.push(new vec4(-1.0, 0.0, 0.0, 0.0)); // normal
    points.push(new vec4(1.0, 0.0, 0.0, 1.0)); // red
    points.push(new vec4(-1.5, -0.5, 0.5, 1.0));
    points.push(new vec4(-1.0, 0.0, 0.0, 0.0)); // normal
    points.push(new vec4(1.0, 0.0, 0.0, 1.0)); // red
    points.push(new vec4(-1.5, 0.5, 0.5, 1.0));
    points.push(new vec4(-1.0, 0.0, 0.0, 0.0)); // normal
    points.push(new vec4(1.0, 0.0, 0.0, 1.0)); // red
    points.push(new vec4(-1.5, 0.5, -0.5, 1.0));
    points.push(new vec4(-1.0, 0.0, 0.0, 0.0)); // normal
    points.push(new vec4(1.0, 0.0, 0.0, 1.0)); // red
    // top
    points.push(new vec4(1.5, 0.5, 0.5, 1.0));
    points.push(new vec4(0.0, 1.0, 0.0, 0.0)); // normal
    points.push(new vec4(0.0, 0.0, 1.0, 1.0)); // blue
    points.push(new vec4(1.5, 0.5, -0.5, 1.0));
    points.push(new vec4(0.0, 1.0, 0.0, 0.0)); // normal
    points.push(new vec4(0.0, 0.0, 1.0, 1.0)); // blue
    points.push(new vec4(-1.5, 0.5, -0.5, 1.0));
    points.push(new vec4(0.0, 1.0, 0.0, 0.0)); // normal
    points.push(new vec4(0.0, 0.0, 1.0, 1.0)); // blue
    points.push(new vec4(-1.5, 0.5, -0.5, 1.0));
    points.push(new vec4(0.0, 1.0, 0.0, 0.0)); // normal
    points.push(new vec4(0.0, 0.0, 1.0, 1.0)); // blue
    points.push(new vec4(-1.5, 0.5, 0.5, 1.0));
    points.push(new vec4(0.0, 1.0, 0.0, 0.0)); // normal
    points.push(new vec4(0.0, 0.0, 1.0, 1.0)); // blue
    points.push(new vec4(1.5, 0.5, 0.5, 1.0));
    points.push(new vec4(0.0, 1.0, 0.0, 0.0)); // normal
    points.push(new vec4(0.0, 0.0, 1.0, 1.0)); // blue
    // bottom
    points.push(new vec4(1.5, -0.5, -0.5, 1.0));
    points.push(new vec4(0.0, -1.0, 0.0, 0.0)); // normal
    points.push(new vec4(0.0, 1.0, 0.0, 1.0)); // green
    points.push(new vec4(1.5, -0.5, 0.5, 1.0));
    points.push(new vec4(0.0, -1.0, 0.0, 0.0)); // normal
    points.push(new vec4(0.0, 1.0, 0.0, 1.0)); // green
    points.push(new vec4(-1.5, -0.5, 0.5, 1.0));
    points.push(new vec4(0.0, -1.0, 0.0, 0.0)); // normal
    points.push(new vec4(0.0, 1.0, 0.0, 1.0)); // green
    points.push(new vec4(-1.5, -0.5, 0.5, 1.0));
    points.push(new vec4(0.0, -1.0, 0.0, 0.0)); // normal
    points.push(new vec4(0.0, 1.0, 0.0, 1.0)); // green
    points.push(new vec4(-1.5, -0.5, -0.5, 1.0));
    points.push(new vec4(0.0, -1.0, 0.0, 0.0)); // normal
    points.push(new vec4(0.0, 1.0, 0.0, 1.0)); // green
    points.push(new vec4(1.5, -0.5, -0.5, 1.0));
    points.push(new vec4(0.0, -1.0, 0.0, 0.0)); // normal
    points.push(new vec4(0.0, 1.0, 0.0, 1.0)); // green
    carverts = points.length / 3;
    // add the ground
    // first triangle
    points.push(new vec4(-50.0, -0.5, -50.0, 1.0));
    points.push(new vec4(0.0, 1.0, 0.0, 0.0)); // normal
    points.push(new vec4(0.0, 0.5, 0.0, 1.0)); // dark green
    points.push(new vec4(50.0, -0.5, -50.0, 1.0));
    points.push(new vec4(0.0, 1.0, 0.0, 0.0)); // normal
    points.push(new vec4(0.0, 0.5, 0.0, 1.0)); // dark green
    points.push(new vec4(50.0, -0.5, 50.0, 1.0));
    points.push(new vec4(0.0, 1.0, 0.0, 0.0)); // normal
    points.push(new vec4(0.0, 0.5, 0.0, 1.0)); // dark green
    // second triangle
    points.push(new vec4(-50.0, -0.5, -50.0, 1.0));
    points.push(new vec4(0.0, 1.0, 0.0, 0.0)); // normal
    points.push(new vec4(0.0, 0.5, 0.0, 1.0)); // dark green
    points.push(new vec4(50.0, -0.5, 50.0, 1.0));
    points.push(new vec4(0.0, 1.0, 0.0, 0.0)); // normal
    points.push(new vec4(0.0, 0.5, 0.0, 1.0)); // dark green
    points.push(new vec4(-50.0, -0.5, 50.0, 1.0));
    points.push(new vec4(0.0, 1.0, 0.0, 0.0)); // normal
    points.push(new vec4(0.0, 0.5, 0.0, 1.0)); // dark green
    groundverts = (points.length / 3) - carverts;
    // add a sphereical building (reference object) model
    let subdiv = 15;
    let r = 2.5;
    let step = (360.0 / subdiv) * (Math.PI / 180.0);
    for (let lat = 0; lat <= Math.PI; lat += step) { // latitude
        for (let lon = 0; lon + step <= 2 * Math.PI; lon += step) { // longitude
            //triangle 1
            points.push(new vec4(r * Math.sin(lat) * Math.sin(lon), r * Math.cos(lat), r * Math.cos(lon) * Math.sin(lat), 1.0));
            points.push(new vec4(r * Math.sin(lat) * Math.sin(lon), r * Math.cos(lat), r * Math.cos(lon) * Math.sin(lat), 0.0)); // normal
            points.push(new vec4(0.5, 0.5, 0.5, 1.0)); // gray
            points.push(new vec4(r * Math.sin(lat) * Math.sin(lon + step), r * Math.cos(lat), r * Math.sin(lat) * Math.cos(lon + step), 1.0));
            points.push(new vec4(r * Math.sin(lat) * Math.sin(lon + step), r * Math.cos(lat), r * Math.sin(lat) * Math.cos(lon + step), 0.0)); // normal
            points.push(new vec4(0.5, 0.5, 0.5, 1.0)); // gray
            points.push(new vec4(r * Math.sin(lat + step) * Math.sin(lon + step), r * Math.cos(lat + step), r * Math.cos(lon + step) * Math.sin(lat + step), 1.0));
            points.push(new vec4(r * Math.sin(lat + step) * Math.sin(lon + step), r * Math.cos(lat + step), r * Math.cos(lon + step) * Math.sin(lat + step), 0.0)); // normal
            points.push(new vec4(0.5, 0.5, 0.5, 1.0)); // gray
            //triangle 2
            points.push(new vec4(r * Math.sin(lat + step) * Math.sin(lon + step), r * Math.cos(lat + step), r * Math.cos(lon + step) * Math.sin(lat + step), 1.0));
            points.push(new vec4(r * Math.sin(lat + step) * Math.sin(lon + step), r * Math.cos(lat + step), r * Math.cos(lon + step) * Math.sin(lat + step), 0.0)); // normal
            points.push(new vec4(0.5, 0.5, 0.5, 1.0)); // gray
            points.push(new vec4(r * Math.sin(lat + step) * Math.sin(lon), r * Math.cos(lat + step), r * Math.sin(lat + step) * Math.cos(lon), 1.0));
            points.push(new vec4(r * Math.sin(lat + step) * Math.sin(lon), r * Math.cos(lat + step), r * Math.sin(lat + step) * Math.cos(lon), 0.0)); // normal
            points.push(new vec4(0.5, 0.5, 0.5, 1.0)); // gray
            points.push(new vec4(r * Math.sin(lat) * Math.sin(lon), r * Math.cos(lat), r * Math.cos(lon) * Math.sin(lat), 1.0));
            points.push(new vec4(r * Math.sin(lat) * Math.sin(lon), r * Math.cos(lat), r * Math.cos(lon) * Math.sin(lat), 0.0)); // normal
            points.push(new vec4(0.5, 0.5, 0.5, 1.0)); // gray
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
        // triangle 1
        points.push(new vec4(x1, -0.05, z1, 1.0));
        points.push(new vec4(x1 / 0.5, 0.0, z1 / 0.5, 0.0)); // normal
        points.push(new vec4(0, 0, 0, 1.0)); // black
        points.push(new vec4(x2, -0.05, z2, 1.0));
        points.push(new vec4(x2 / 0.5, 0.0, z2 / 0.5, 0.0)); // normal
        points.push(new vec4(0, 0, 0, 1.0)); // black
        points.push(new vec4(x1, 0.05, z1, 1.0));
        points.push(new vec4(x1 / 0.5, 0.0, z1 / 0.5, 0.0)); // normal
        points.push(new vec4(0, 0, 0, 1.0)); // black
        // triangle 2
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
        // triangle fan
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
    // add tall, multicolored building to be drawn four times
    // front face
    points.push(new vec4(1.0, -0.5, 1.0, 1.0));
    points.push(new vec4(0.0, 0.0, 1.0, 0.0)); // normal
    points.push(new vec4(0.0, 1.0, 1.0, 1.0)); // cyan
    points.push(new vec4(1.0, 10.0, 1.0, 1.0));
    points.push(new vec4(0.0, 0.0, 1.0, 0.0)); // normal
    points.push(new vec4(0.0, 1.0, 1.0, 1.0)); // cyan
    points.push(new vec4(-1.0, 10.0, 1.0, 1.0));
    points.push(new vec4(0.0, 0.0, 1.0, 0.0)); // normal
    points.push(new vec4(0.0, 1.0, 1.0, 1.0)); // cyan
    points.push(new vec4(-1.0, 10.0, 1.0, 1.0));
    points.push(new vec4(0.0, 0.0, 1.0, 0.0)); // normal
    points.push(new vec4(0.0, 1.0, 1.0, 1.0)); // cyan
    points.push(new vec4(-1.0, -0.5, 1.0, 1.0));
    points.push(new vec4(0.0, 0.0, 1.0, 0.0)); // normal
    points.push(new vec4(0.0, 1.0, 1.0, 1.0)); // cyan
    points.push(new vec4(1.0, -0.5, 1.0, 1.0));
    points.push(new vec4(0.0, 0.0, 1.0, 0.0)); // normal
    points.push(new vec4(0.0, 1.0, 1.0, 1.0)); // cyan
    // back face
    points.push(new vec4(1.0, -0.5, -1.0, 1.0));
    points.push(new vec4(0.0, 0.0, 1.0, 0.0)); // normal
    points.push(new vec4(1.0, 0.0, 1.0, 1.0)); // magenta
    points.push(new vec4(1.0, 10.0, -1.0, 1.0));
    points.push(new vec4(0.0, 0.0, 1.0, 0.0)); // normal
    points.push(new vec4(1.0, 0.0, 1.0, 1.0)); // magenta
    points.push(new vec4(-1.0, 10.0, -1.0, 1.0));
    points.push(new vec4(0.0, 0.0, 1.0, 0.0)); // normal
    points.push(new vec4(1.0, 0.0, 1.0, 1.0)); // magenta
    points.push(new vec4(-1.0, 10.0, -1.0, 1.0));
    points.push(new vec4(0.0, 0.0, 1.0, 0.0)); // normal
    points.push(new vec4(1.0, 0.0, 1.0, 1.0)); // magenta
    points.push(new vec4(-1.0, -0.5, -1.0, 1.0));
    points.push(new vec4(0.0, 0.0, 1.0, 0.0)); // normal
    points.push(new vec4(1.0, 0.0, 1.0, 1.0)); // magenta
    points.push(new vec4(1.0, -0.5, -1.0, 1.0));
    points.push(new vec4(0.0, 0.0, 1.0, 0.0)); // normal
    points.push(new vec4(1.0, 0.0, 1.0, 1.0)); // magenta
    // right face
    points.push(new vec4(1.0, 10.0, 1.0, 1.0));
    points.push(new vec4(1.0, 0.0, 0.0, 0.0)); // normal
    points.push(new vec4(1.5, 1.0, 0.0, 1.0)); // yellow
    points.push(new vec4(1.0, -0.5, 1.0, 1.0));
    points.push(new vec4(1.0, 0.0, 0.0, 0.0)); // normal
    points.push(new vec4(1.5, 1.0, 0.0, 1.0)); // yellow
    points.push(new vec4(1.0, -0.5, -1.0, 1.0));
    points.push(new vec4(1.0, 0.0, 0.0, 0.0)); // normal
    points.push(new vec4(1.5, 1.0, 0.0, 1.0)); // yellow
    points.push(new vec4(1.0, -0.5, -1.0, 1.0));
    points.push(new vec4(1.0, 0.0, 0.0, 0.0)); // normal
    points.push(new vec4(1.5, 1.0, 0.0, 1.0)); // yellow
    points.push(new vec4(1.0, 10.0, -1.0, 1.0));
    points.push(new vec4(1.0, 0.0, 0.0, 0.0)); // normal
    points.push(new vec4(1.5, 1.0, 0.0, 1.0)); // yellow
    points.push(new vec4(1.0, 10.0, 1.0, 1.0));
    points.push(new vec4(1.0, 0.0, 0.0, 0.0)); // normal
    points.push(new vec4(1.5, 1.0, 0.0, 1.0)); // yellow
    // left face
    points.push(new vec4(-1.0, 10.0, 1.0, 1.0));
    points.push(new vec4(1.0, 0.0, 0.0, 0.0)); // normal
    points.push(new vec4(1.0, 0.0, 0.0, 1.0)); // red
    points.push(new vec4(-1.0, -0.5, 1.0, 1.0));
    points.push(new vec4(1.0, 0.0, 0.0, 0.0)); // normal
    points.push(new vec4(1.0, 0.0, 0.0, 1.0)); // red
    points.push(new vec4(-1.0, -0.5, -1.0, 1.0));
    points.push(new vec4(1.0, 0.0, 0.0, 0.0)); // normal
    points.push(new vec4(1.0, 0.0, 0.0, 1.0)); // red
    points.push(new vec4(-1.0, -0.5, -1.0, 1.0));
    points.push(new vec4(1.0, 0.0, 0.0, 0.0)); // normal
    points.push(new vec4(1.0, 0.0, 0.0, 1.0)); // red
    points.push(new vec4(-1.0, 10.0, -1.0, 1.0));
    points.push(new vec4(1.0, 0.0, 0.0, 0.0)); // normal
    points.push(new vec4(1.0, 0.0, 0.0, 1.0)); // red
    points.push(new vec4(-1.0, 10.0, 1.0, 1.0));
    points.push(new vec4(1.0, 0.0, 0.0, 0.0)); // normal
    points.push(new vec4(1.0, 0.0, 0.0, 1.0)); // red
    tallbuildingverts = (points.length / 3) - carverts - groundverts - buildingverts - wheelverts - headlightverts;
    // create buffer
    bufferId = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, bufferId);
    // send the local data over to this buffer on the graphics card
    gl.bufferData(gl.ARRAY_BUFFER, flatten(points), gl.STATIC_DRAW);
    // data is packed in groups of 4 floats which are 4 bytes each, 48 bytes total for position, normal, and color
    // position                       normal                     color
    //  x   y   z     w        x     y     z     w        r     g     b     a
    // 0-3 4-7 8-11 12-15    16-19 20-23 24-27 28-31    32-35 36-39 40-43 44-47
    // set up attribute pointers
    vPosition = gl.getAttribLocation(program, "vPosition");
    gl.vertexAttribPointer(vPosition, 4, gl.FLOAT, false, 48, 0);
    gl.enableVertexAttribArray(vPosition);
    vNormal = gl.getAttribLocation(program, "vNormal");
    gl.vertexAttribPointer(vNormal, 4, gl.FLOAT, false, 48, 16);
    gl.enableVertexAttribArray(vNormal);
    vColor = gl.getAttribLocation(program, "vColor");
    gl.vertexAttribPointer(vColor, 4, gl.FLOAT, false, 48, 32);
    gl.enableVertexAttribArray(vColor);
}
// generate semisphere and send to graphics card
function generateSemisphere(subdiv) {
    // helper function to generate spherical coordinates
    function spherePoint(lat, lon) {
        const x = Math.sin(lat) * Math.cos(lon);
        const y = Math.cos(lat);
        const z = Math.sin(lat) * Math.sin(lon);
        return [x, y, z];
    }
    const stepLat = Math.PI / subdiv; // latitude from 0 -> PI/2
    const stepLon = 2 * Math.PI / subdiv; // full longitude
    let semisphereverts = []; // interleaved position and normal
    for (let lat = 0; lat < Math.PI / 2; lat += stepLat) {
        for (let lon = 0; lon < 2 * Math.PI; lon += stepLon) {
            const p0 = spherePoint(lat, lon);
            const p1 = spherePoint(lat + stepLat, lon);
            const p2 = spherePoint(lat + stepLat, lon + stepLon);
            const p3 = spherePoint(lat, lon + stepLon);
            // triangle 1
            semisphereverts.push(new vec4(p0[0], p0[1], p0[2], 1.0)); // position
            semisphereverts.push(new vec4(p0[0], p0[1], p0[2], 0.0)); // normal
            semisphereverts.push(new vec4(p1[0], p1[1], p1[2], 1.0)); // position
            semisphereverts.push(new vec4(p1[0], p1[1], p1[2], 0.0)); // normal
            semisphereverts.push(new vec4(p2[0], p2[1], p2[2], 1.0)); // position
            semisphereverts.push(new vec4(p2[0], p2[1], p2[2], 0.0)); // normal
            // triangle 2
            semisphereverts.push(new vec4(p0[0], p0[1], p0[2], 1.0)); // position
            semisphereverts.push(new vec4(p0[0], p0[1], p0[2], 0.0)); // normal
            semisphereverts.push(new vec4(p3[0], p3[1], p3[2], 1.0)); // position
            semisphereverts.push(new vec4(p3[0], p3[1], p3[2], 0.0)); // normal
            semisphereverts.push(new vec4(p2[0], p2[1], p2[2], 1.0)); // position
            semisphereverts.push(new vec4(p2[0], p2[1], p2[2], 0.0)); // normal
        }
    }
    // create buffer
    semisphereId = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, semisphereId);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(semisphereverts), gl.STATIC_DRAW);
    semisphereVertCount = semisphereverts.length / 2;
    // setup attribute pointers
    gl.vertexAttribPointer(vSemispherePosition, 4, gl.FLOAT, false, 32, 0);
    gl.enableVertexAttribArray(vSemispherePosition);
    gl.vertexAttribPointer(vSemisphereNormal, 4, gl.FLOAT, false, 32, 16);
    gl.enableVertexAttribArray(vSemisphereNormal);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
}
// generate the model_view matrix for the chase camera
function getChaseCameraView() {
    // camera location in car local coordinates
    let driverEyes = new vec4(5.0, 1.0, 0.0, 1.0);
    // apply translations and rotations of car's movement
    let eyeX = xoffset + driverEyes[0] * Math.cos(heading);
    let eyeY = driverEyes[1];
    let eyeZ = zoffset - driverEyes[0] * Math.sin(heading);
    return lookAt(new vec4(eyeX, eyeY, eyeZ, 1), new vec4(xoffset, 0.6, zoffset, 1), new vec4(0, 1, 0, 0));
}
// generate projection matrix for chase camera
function getChaseCameraProjection() {
    return perspective(60, canvas.width / canvas.height, 0.1, 500.0);
}
// draw objects
function drawSceneObjects(view, proj, excludeSemisphere) {
    // skybox pass
    // push skybox to infinite distance
    gl.depthFunc(gl.LEQUAL);
    gl.useProgram(skyboxProgram);
    // set view transpose = true so skybox rotates with camera correctly
    gl.uniformMatrix4fv(uSkyView, true, view.flatten());
    gl.uniformMatrix4fv(uSkyProj, false, proj.flatten());
    // set up skybox texture for fragment shader
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, skyboxTexture);
    gl.uniform1i(uSkyboxSampler, 1);
    gl.bindBuffer(gl.ARRAY_BUFFER, skyboxId);
    gl.enableVertexAttribArray(vSkyPosition);
    gl.vertexAttribPointer(vSkyPosition, 3, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 36); // draw the skybox
    gl.depthFunc(gl.LESS); // re-enable depth testing
    // scene pass
    gl.useProgram(program);
    // set up light attributes
    gl.vertexAttrib4fv(vSpecularColor, [1, 1, 1, 1]);
    gl.vertexAttrib1f(vSpecularExponent, 5.0);
    gl.uniform4fv(ambient_light, [0.3, 0.3, 0.3, 1]);
    // send over light uniform values
    gl.uniform4fv(lightPosition[0], [0, 100, 0, 1]);
    gl.uniform4fv(lightColor[0], [1, 1, 1, 1]);
    gl.uniform1i(on_off[0], lightSwitches[0] ? 1 : 0);
    gl.uniformMatrix4fv(uproj, false, proj.flatten());
    // compute + send headlight uniforms FIRST, before anything they should light up gets drawn
    const headlightOffsets = [
        [-1.55, 0.0, -0.3],
        [-1.55, 0.0, 0.3]
    ];
    const localPos = new vec4(0.0, 0.05, 0.0, 1.0);
    const localDir = new vec4(0.0, 1.0, 0.0, 0.0);
    const headlightMVs = [];
    let headlightIndex = 1;
    for (const [x, y, z] of headlightOffsets) {
        const lmv = view
            .mult(translate(xoffset, 0.0, zoffset))
            .mult(rotateY(heading * 180.0 / Math.PI))
            .mult(translate(x, y, z))
            .mult(rotateZ(90.0));
        headlightMVs.push(lmv);
        const eyePos = lmv.mult(localPos);
        const dirMV = view
            .mult(rotateY(heading * 180.0 / Math.PI))
            .mult(rotateZ(90.0));
        const eyeDir = dirMV.mult(localDir);
        gl.uniform4fv(lightPosition[headlightIndex], eyePos.flatten());
        gl.uniform4fv(lightColor[headlightIndex], [1, 1, 1, 1]);
        gl.uniform4fv(lightDirection[headlightIndex], eyeDir.flatten());
        gl.uniform1i(on_off[headlightIndex], lightSwitches[headlightIndex] ? 1 : 0);
        headlightIndex++;
    }
    // car body
    let mv = view
        .mult(translate(xoffset, 0.0, zoffset))
        .mult(rotateY(heading * 180 / Math.PI));
    gl.uniformMatrix4fv(umv, false, mv.flatten());
    gl.bindBuffer(gl.ARRAY_BUFFER, bufferId);
    gl.vertexAttribPointer(vPosition, 4, gl.FLOAT, false, 48, 0);
    gl.enableVertexAttribArray(vPosition);
    vNormal = gl.getAttribLocation(program, "vNormal");
    gl.vertexAttribPointer(vNormal, 4, gl.FLOAT, false, 48, 16);
    gl.enableVertexAttribArray(vNormal);
    gl.vertexAttribPointer(vColor, 4, gl.FLOAT, false, 48, 32);
    gl.enableVertexAttribArray(vColor);
    gl.drawArrays(gl.TRIANGLES, 0, carverts); // draw car
    // ground
    mv = view;
    gl.uniformMatrix4fv(umv, false, mv.flatten());
    gl.drawArrays(gl.TRIANGLES, carverts, groundverts);
    // buildings
    const buildingOffsets = [
        [-10, -0.5, -10],
        [10, -0.5, -10],
        [-10, -0.5, 10],
        [10, -0.5, 10]
    ];
    for (const [x, y, z] of buildingOffsets) {
        mv = view.mult(translate(x, y, z));
        gl.uniformMatrix4fv(umv, false, mv.flatten());
        gl.drawArrays(gl.TRIANGLES, carverts + groundverts, buildingverts); // draw each building
    }
    // add front wheels
    const frontWheelOffsets = [
        [-1.5, 0.0, 0.5],
        [-1.5, 0.0, -0.5]
    ];
    for (const [x, y, z] of frontWheelOffsets) {
        mv = view
            .mult(translate(xoffset, 0.0, zoffset))
            .mult(rotateY(heading * 180.0 / Math.PI))
            .mult(translate(x, y, z))
            .mult(rotateY(yrot))
            .mult(rotateZ(zrot))
            .mult(rotateX(90.0));
        gl.uniformMatrix4fv(umv, false, mv.flatten());
        gl.drawArrays(gl.TRIANGLES, carverts + groundverts + buildingverts, wheelverts); // draw each wheel
    }
    // add back wheels
    const backWheelOffsets = [
        [1.5, 0.0, 0.5],
        [1.5, 0.0, -0.5]
    ];
    for (const [x, y, z] of backWheelOffsets) {
        mv = view
            .mult(translate(xoffset, 0.0, zoffset))
            .mult(rotateY(heading * 180.0 / Math.PI))
            .mult(translate(x, y, z))
            .mult(rotateZ(zrot))
            .mult(rotateX(90.0));
        gl.uniformMatrix4fv(umv, false, mv.flatten());
        gl.drawArrays(gl.TRIANGLES, carverts + groundverts + buildingverts, wheelverts); // draw each wheel
    }
    // draw headlight meshes (uniforms already set above, before the car body was drawn)
    for (let i = 0; i < headlightMVs.length; i++) {
        gl.uniformMatrix4fv(umv, false, headlightMVs[i].flatten());
        gl.drawArrays(gl.TRIANGLES, carverts + groundverts + buildingverts + wheelverts, headlightverts); // draw each headlight
    }
    // draw tall multicolor buildings
    const tallBuildingOffsets = [
        [0.0, 0.0, 10],
        [0.0, 0.0, -10],
        [-10, 0.0, 0.0],
        [10, 0.0, 0.0]
    ];
    for (const [x, y, z] of tallBuildingOffsets) {
        mv = view.mult(translate(x, y, z));
        gl.uniformMatrix4fv(umv, false, mv.flatten());
        gl.drawArrays(gl.TRIANGLES, carverts + groundverts + buildingverts + wheelverts + headlightverts, tallbuildingverts); // draw each building
    }
    if (!excludeSemisphere) {
        drawSemisphere();
    }
}
// draw the semisphere
function drawSemisphere() {
    gl.useProgram(semisphereProgram);
    // semisphere has a separate model matrix to transition semisphere from model to world space
    // apply same transformations as the ones applied to the car
    let model = translate(xoffset, 0.0, zoffset)
        .mult(rotateY(heading * 180.0 / Math.PI))
        .mult(translate(0.0, 0.6, 0.0)); // raise semisphere to top of car
    let view = getChaseCameraView();
    let proj = getChaseCameraProjection();
    gl.uniformMatrix4fv(uSemisphereModel, false, model.flatten());
    gl.uniformMatrix4fv(uSemisphereView, false, view.flatten());
    gl.uniformMatrix4fv(uSemisphereProj, false, proj.flatten());
    // bind semisphere buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, semisphereId);
    // setup attribute pointers
    gl.vertexAttribPointer(vSemispherePosition, 4, gl.FLOAT, false, 32, 0);
    gl.enableVertexAttribArray(vSemispherePosition);
    gl.vertexAttribPointer(vSemisphereNormal, 4, gl.FLOAT, false, 32, 16);
    gl.enableVertexAttribArray(vSemisphereNormal);
    gl.drawArrays(gl.TRIANGLES, 0, semisphereVertCount); // draw the semisphere
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
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
// draw a new frame
function render() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    // render the cubemap
    renderEnvironmentCubemapFull();
    const view = getChaseCameraView();
    const proj = getChaseCameraProjection();
    // draw all objects except semisphere
    drawSceneObjects(view, proj, true);
    // bind env cubemap and draw semisphere with refractive shader
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, envCubemap);
    gl.useProgram(semisphereProgram);
    gl.uniform1i(uEnvCubemapSampler, 0);
    // draw refractive glass semisphere
    drawSemisphere();
}
