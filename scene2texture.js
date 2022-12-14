import {tiny} from './tiny-graphics/common.js';

const {
    Vector, Vector3, vec, vec3, vec4, color, hex_color, Shader, Matrix, Mat4, Light, Shape, Material, Scene, Texture
} = tiny;


/**
 * Scene2Texture is a static class that handles converting scene drawing to textures.
 */
export class Scene2Texture {
    static scene_drawers = [];

    /**
     * Register a scene drawer to be drawn.
     * @param scene_drawer -- The scene drawer object.
     */
    static register(scene_drawer) {
        Scene2Texture.scene_drawers.push(scene_drawer);
    }

    /**
     * This function should be called per frame before any other drawings.
     * It will draw all registered scene drawers and clean up the GPU buffer afterwards.
     * The drew scene will be updated to scene drawer's texture.
     */
    static draw(context, program_state) {
        // Skip first frame
        if (!this.skip) {
            this.skip = true;
            return;
        }

        const aspect_ratio = context.width / context.height;
        const width_backup = context.width;
        const height_backup = context.height;

        // Backup camera matrix, projection matrix, and light
        const cam_matrix_backup = program_state.camera_inverse;
        const proj_matrix_backup = program_state.projection_transform;
        const light_backup = program_state.lights;

        for (let scene_drawer of Scene2Texture.scene_drawers) {
            // Set the aspect ratio temporarily
            context.width = scene_drawer.width;
            context.height = scene_drawer.height;

            // Draw the scene
            scene_drawer.display_fn(context, program_state);

            // Restore the aspect ratio
            context.width = width_backup;
            context.height = height_backup;

            // Generate image
            // scene_drawer.scratchpad_context.drawImage(context.canvas, 0, 0, scene_drawer.width, scene_drawer.height / aspect_ratio);
            scene_drawer.scratchpad_context.drawImage(context.canvas, 0, 0, scene_drawer.width, scene_drawer.height);
            scene_drawer.texture.image.src = scene_drawer.scratchpad.toDataURL("image/png");

            // Copy onto GPU
            if (scene_drawer.skip_first) {
                scene_drawer.texture.copy_onto_graphics_card(context.context, false);
            }
            scene_drawer.skip_first = true;

            // Cleanup
            context.context.clear(context.context.COLOR_BUFFER_BIT | context.context.DEPTH_BUFFER_BIT);
            program_state.set_camera(cam_matrix_backup);
            program_state.projection_transform = proj_matrix_backup;
            program_state.lights = light_backup;
        }
    }
}

/**
 * SceneDrawer handles drawing a scene to a texture.
 */
export class SceneDrawer {
    /**
     * @param width         Width of the scene
     * @param height        Height of the scene
     * @param display_fn    Function to display the scene
     */
    constructor(width, height, display_fn) {
        this.width = width;
        this.height = height;
        this.display_fn = display_fn;

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        this.scratchpad = canvas;
        this.scratchpad_context = canvas.getContext("2d");
        this.texture = new Texture("data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7");
    }
}
