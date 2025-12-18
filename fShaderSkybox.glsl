#version 300 es
precision highp float;

in vec3 vDirection;
out vec4 outColor;

uniform samplerCube uSkyboxSampler;

void main() {
    // sample the skybox texture
    outColor = texture(uSkyboxSampler, vDirection);
}
