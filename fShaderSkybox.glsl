#version 300 es
precision highp float;

in vec3 vDirection;
out vec4 outColor;

uniform samplerCube uSkyboxSampler;

void main() {
    outColor = texture(uSkyboxSampler, vDirection);
}
