#version 300 es
precision mediump float;

in vec4 Position;
in vec4 color;
in vec4 Normal;

in vec4 SpecularColor;
in float SpecularExponent;

uniform mat4 model_view;
uniform mat4 projection;
uniform vec4 ambient_light;

uniform float cosTheta;

uniform vec4 lightPosition[3];
uniform vec4 lightColor[3];
uniform vec4 lightDirection[3];
uniform bool on_off[3];

out vec4 fColor;

void main() {
    // initialze light parameters for Phong lighting calculation
    vec4 amb = color * ambient_light;
    vec4 diff = vec4(0, 0, 0, 1);
    vec4 spec = vec4(0, 0, 0, 1);

    // get camera position, view vectors, and normals into eye space
    vec4 veyepos = model_view * Position;
    vec3 V = normalize(-veyepos.xyz);
    vec3 N = normalize((model_view * Normal).xyz);

    for (int i = 0; i < 3; i++) {
        if (!on_off[i]) continue; // if the light is off, skip its contribution

        // if the light is a headlight, restrict its illumination to a cone
        if (i == 1 || i == 2) {
            float cosPhi = dot(normalize(veyepos.xyz - lightPosition[i].xyz), normalize(lightDirection[i].xyz));
            if (cosPhi < cosTheta) continue;
        }

        // get light vectore and relfection vector
        vec3 L = normalize(lightPosition[i].xyz - veyepos.xyz);
        vec3 R = reflect(-L, N);

        // add contribution to diffuse term
        diff += max(dot(L, N), 0.0) * color * lightColor[i];

        // if specular highlight is facing towards camera, show it
        if (dot(L, N) >= 0.0) {
            // add contribution to specular term
            spec += pow(max(dot(R, V), 0.0), SpecularExponent) * SpecularColor * lightColor[i];
        }
    }

    fColor = amb + diff + spec;
}