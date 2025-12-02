#version 300 es
precision highp float;

in vec3 vSkyPosition;
out vec3 vDirection;

uniform mat4 uProjection;
uniform mat4 uView;

void main() {

    // Apply only rotation, remove translation
    mat3 rotationOnly = mat3(uView);  // take upper-left 3x3

    // Rotate the skybox according to the camera orientation
    vDirection = rotationOnly * vSkyPosition;

    // Push skybox to infinity
    vec4 pos = uProjection * vec4(vSkyPosition, 1.0);
    gl_Position = pos.xyww; // force skybox to infinite distance (w / w => depth = 1.0)

}
