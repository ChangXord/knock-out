import {defs, tiny} from './tiny-graphics/common.js';
import {Camera} from "./camera.js";
import {Chip, Obstacle, SkyBox, Table} from "./entity.js";
import {GameAnimation, PlayerAvatar, TopBanner, TurnAnimation, UI} from "./ui.js";
import {Scene2Texture} from "./scene2texture.js";
import {CylinderCollider, CylinderCylinderCollision} from './collider.js';
import {MousePicking} from "./mouse-picking.js";
import {collide, move} from './physics.js';

const {
    Vector, Vector3, vec, vec3, vec4, color, hex_color, Shader, Matrix, Mat4, Light, Shape, Material, Scene,
} = tiny;


/**
 * Main scene of the game.
 */
export class KnockOut extends Scene {
    constructor() {
        super();

        // Objects
        this.entities = {
            table: new Table(),
            obstacle_left: new Obstacle("left"),
            obstacle_right: new Obstacle("right"),
            skybox: new SkyBox(),
        };
        this.player1_chips = [new Chip("player1", 1), new Chip("player1", 2), new Chip("player1", 3),];
        this.player2_chips = [new Chip("player2", 4), new Chip("player2", 5), new Chip("player2", 6),];

        for (const chip of this.player1_chips) {
            chip.collider = new CylinderCollider(chip);
        }
        for (const chip of this.player2_chips) {
            chip.collider = new CylinderCollider(chip);
        }

        this.test_collision_chip = new Chip("player1", 1);
        this.test_collision_chip.place(0.5, 0);
        this.test_collision_chip.collider = new CylinderCollider(this.test_collision_chip);
        this.colliders = [];

        // UI
        this.game_animation = new GameAnimation();
        this.turn_animation = new TurnAnimation();
        this.ui = [new TopBanner(), new PlayerAvatar(), this.game_animation, this.turn_animation];

        // Game control
        this.game = null;

        // Camera and view
        this.view = 0;
        this.currentView = null;
        this.orthographic = false;
        this.cameras = [new Camera()];
        // Frame rate
        this.frame_rate = 0;
        this.initialized = false;
    }

    make_control_panel() {
        this.live_string(box => {
            box.textContent = `Frame rate: ${this.frame_rate.toFixed(2)}`;
        });
        this.new_line();

        this.key_triggered_button("Start Game!", ["0"], function () {
            this.initialized = true;
            this.turn_animation.start();
        }.bind(this));
        this.new_line();
        this.new_line();

        this.key_triggered_button("Change Perspective", ["v"], function () {
            this.view += 1;
            this.view %= 3;
        });
        this.key_triggered_button("Toggle Orthographic View", ["0"], function () {
            this.orthographic = !this.orthographic;
        });
        this.key_triggered_button("Reset Camera", ["r"], function () {
            this.cameras[0].reset();
        });

        this.new_line();
        this.key_triggered_button("Change player", ["c"], () => {
            UI.switch_player();
            this.turn_animation.start();
        });
        this.key_triggered_button("Move chips", ["m"], function () {
            this.start = true;
        });

        this.new_line();
        this.new_line();
        this.live_string(box => box.textContent = "Animation Debug");
        this.new_line();
        this.key_triggered_button("Game start", [], () => {
            this.game_animation.start();
        });
        this.key_triggered_button("Game stop", [], () => {
            this.game_animation.end();
        });
        this.new_line();
        this.key_triggered_button("Turn start", [], () => {
            this.turn_animation.start();
        });
        this.key_triggered_button("Turn stop", [], () => {
            this.turn_animation.end();
        });
    }

    /**
     * Handles the display and update of all objects.
     */
    display(context, program_state) {
        // Setup control panel
        if (!context.scratchpad.controls) {
            this.children.push(context.scratchpad.controls = new defs.Movement_Controls());
        }

        // Setup mouse picking
        if (!this.mouse_picking_p1 || !this.mouse_picking_p2) {
            const canvas = document.querySelector("#knockout-canvas");
            if (canvas) {
                this.mouse_picking_p1 = new MousePicking(canvas, this.player1_chips, hex_color("#ff556f"));
                this.mouse_picking_p2 = new MousePicking(canvas, this.player2_chips, hex_color("#5aa6ff"));
            }
        }

        // Switch camera view
        if (this.view !== this.currentView) {
            switch (this.view) {
                case 0:
                    this.cameras[0].LeftPerspective();
                    break;
                case 1:
                    this.cameras[0].RightPerspective();
                    break;
                case 2:
                    this.cameras[0].birdEye();
                    break;
            }

            this.ticks = 0;
            this.currentView = this.view;
        }

        this.cameras[0].update();
        program_state.set_camera(this.cameras[0].camera_matrix);
        //program_state.set_camera(desired.map((x,i) => i==0? Vector.from(program_state.camera_inverse[i]).mix(x, 0.1):desired[i]));

        // Calculate time
        const t = program_state.animation_time / 1000, dt = program_state.animation_delta_time / 1000;

        // Update frame rate
        this.frame_rate = 1 / dt;
        if (!this.initialized) {
            this.initialized = true;
            program_state.projection_transform = Mat4.perspective(Math.PI / 4, context.width / context.height, 1, 10000);
        }
        // Setup projection matrix
        if (!this.orthographic) {
            var desired = Mat4.perspective(
            Math.PI / 4, context.width / context.height, 1, 10000);
            program_state.projection_transform = desired.map((x, i) => Vector.from(program_state.projection_transform[i]).mix(x, 0.05));
        }
        else {
            const right = -10;
            const left = 10;
            const bottom = -6;
            const top = 8;
            const near = 1;
            const far = 100;
            var desired = Mat4.scale(1 / (right - left), 1 / (top - bottom), 1 / (far - near))
                .times(Mat4.translation(-right / (right - left), -top / (top - bottom), -far / (far - near)))
                .times(Mat4.scale(-3, 3, -3));
            program_state.projection_transform = desired.map((x, i) => Vector.from(program_state.projection_transform[i]).mix(x, 0.2));
        }

        // Setup light
        const light_position = vec4(0, 0, 0, 1);
        const top_light_position = vec4(0, 10, 0, 1);
        program_state.lights = [new Light(light_position, color(1, 1, 1, 1), 10000), new Light(top_light_position, color(1, 1, 1, 1), 10000)];

        // Do sub-scene graphics before the main scene
        Scene2Texture.draw(context, program_state);

        for (const chip of this.player1_chips) {
            chip.collider = new CylinderCollider(chip);
        }
        for (const chip of this.player2_chips) {
            chip.collider = new CylinderCollider(chip);
        }

        // Mouse picking
        this.mouse_picking_p1.update(context, program_state);
        this.mouse_picking_p2.update(context, program_state);
        if (UI.player === 0) {
            this.mouse_picking_p1.enable_mouse_picking();
            this.mouse_picking_p2.disable_mouse_picking();
        } else {
            this.mouse_picking_p1.disable_mouse_picking();
            this.mouse_picking_p2.enable_mouse_picking();
        }
        if (!this.initialized) {
            this.mouse_picking_p1.disable_mouse_picking();
            this.mouse_picking_p2.disable_mouse_picking();
        }

        // game starts, update chips information
        // add this.end to stop the game
        if (this.start) {
            this.start = !this.start;
            for (const i in this.player1_chips) {
                if (this.mouse_picking_p1.forces[i][1] !== null) {
                    this.player1_chips[i].velocity = this.mouse_picking_p1.forces[i][1];
                }
            }
            for (const i in this.player2_chips) {
                if (this.mouse_picking_p2.forces[i][1] !== null) {
                    this.player2_chips[i].velocity = this.mouse_picking_p2.forces[i][1];
                }
            }
            this.mouse_picking_p1.reset();
            this.mouse_picking_p2.reset();
        }
        // console.log(this.player1_chips[0].velocity);
        // console.log(this.mouse_picking_p1.forces);

        // Update and draw all entities
        for (const i in this.entities) {
            // console.log(i)
            this.entities[i].draw(context, program_state);
            // console.log(this.entities[i].get_info())
        }
        // console.log(this.player2_chips[0].collider);

        for (const i in this.player1_chips) {
            move(this.player1_chips[i], dt);
            for (const j in this.player2_chips) {
                if (CylinderCylinderCollision(this.player1_chips[i].collider, this.player2_chips[j].collider)) {
                    console.log("collision");
                    // this.player1_chips[i].velocity = vec(0, 0);
                    collide(this.player1_chips[i], this.player2_chips[j]);
                }
            }
            for (const j in this.player1_chips) {
                if (i !== j && CylinderCylinderCollision(this.player1_chips[i].collider, this.player1_chips[j].collider)) {
                    console.log("collision");
                    collide(this.player1_chips[i], this.player1_chips[j]);
                }
            }
            this.player1_chips[i].draw(context, program_state);
        }
        // console.log(this.player1_chips[0].velocity);
        // this.test_collision_chip.draw(context, program_state);
        // if (CylinderCylinderCollision(this.test_collision_chip.collider, this.player1_chips[0].collider)) {
        //     console.log("collision");
        // }
        // console.log(this.test_collision_chip.get_info());
        for (const i in this.player2_chips) {
            move(this.player2_chips[i], dt);
            for (const j in this.player1_chips) {
                if (CylinderCylinderCollision(this.player2_chips[i].collider, this.player1_chips[j].collider)) {
                    collide(this.player2_chips[i], this.player1_chips[j]);
                }
            }
            for (const j in this.player2_chips) {
                if (i !== j && CylinderCylinderCollision(this.player2_chips[i].collider, this.player2_chips[j].collider)) {
                    collide(this.player2_chips[i], this.player2_chips[j]);
                }
            }
            this.player2_chips[i].draw(context, program_state);
        }

        // Update and draw all ui
        UI.update_camera(program_state.camera_inverse);  // Only need to update camera once
        for (const i in this.ui) {
            this.ui[i].display(context, program_state);
        }
    }
}
