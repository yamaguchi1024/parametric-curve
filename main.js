let gl;
let canvas;
let legacygl;
let drawutil;
let camera;

let points = [];
let selected = null;

// ポイントが動くモードに入っているか
let ispointmove = false;
// 右クリックを押したときのマウスの位置、ポイントを追加する為に必要
let right_click_mouse_pos;

function eval_quadratic_bezier(p0, p1, p2, t) {
  // 元のコード
  // return numeric.add(numeric.mul(1 - t, p0), numeric.mul(t, p2));

  // Two dimension bezier curve. 二次ベジェ曲線
  return numeric.add(numeric.add(numeric.mul(numeric.mul(1-t,1-t), p0),
    numeric.mul(2, numeric.mul(t, numeric.mul((1-t), p1)))), numeric.mul(numeric.mul(t,t), p2));
}

function draw() {
  console.log(points);

  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  // projection & camera position
  mat4.perspective(legacygl.uniforms.projection.value, Math.PI / 6, canvas.aspect_ratio(), 0.1, 1000);
  let modelview = legacygl.uniforms.modelview;
  camera.lookAt(modelview.value);

  // xy grid
  gl.lineWidth(1);
  legacygl.color(0.5, 0.5, 0.5);
  drawutil.xygrid(100);

  // draw line segments composing curve
  legacygl.color(1, 0.6, 0.2);
  legacygl.begin(gl.LINE_STRIP);
  let numsteps = Number(document.getElementById("input_numsteps").value);
  for (let i = 0; i <= numsteps; ++i) {
    let t = i / numsteps;

    //legacygl.vertex2(eval_quadratic_bezier(p0, p1, p2, t));

  }

  legacygl.end();

  // draw sample points
  if (document.getElementById("input_show_samplepoints").checked) {
    legacygl.begin(gl.POINTS);
    for (let i = 0; i <= numsteps; ++i) {
      let t = i / numsteps;

      //legacygl.vertex2(eval_quadratic_bezier(p0, p1, p2, t));

    }
    legacygl.end();
  }

  // draw control points
  if (document.getElementById("input_show_controlpoints").checked) {
    legacygl.color(0.2, 0.5, 1);
    legacygl.begin(gl.LINE_STRIP);
    for (let i = 0; i < points.length; i++) {
      legacygl.vertex2(points[i]);
    }

    legacygl.end();
    legacygl.begin(gl.POINTS);
    for (let i = 0; i < points.length; i++) {
      legacygl.vertex2(points[i]);
    }

    legacygl.end();
  }
};

function getMousePos (mouse_win) {
  mouse_win.push(1);
  return glu.unproject(mouse_win, 
    legacygl.uniforms.modelview.value,
    legacygl.uniforms.projection.value,
    [0, 0, canvas.width, canvas.height]);
}

function init() {
  // OpenGL context
  canvas = document.getElementById("canvas");
  gl = canvas.getContext("experimental-webgl");
  if (!gl)
    alert("Could not initialise WebGL, sorry :-(");
  let vertex_shader_src = "\
  attribute vec3 a_vertex;\
  attribute vec3 a_color;\
  varying vec3 v_color;\
  uniform mat4 u_modelview;\
  uniform mat4 u_projection;\
  void main(void) {\
    gl_Position = u_projection * u_modelview * vec4(a_vertex, 1.0);\
    v_color = a_color;\
    gl_PointSize = 5.0;\
  }\
  ";
  let fragment_shader_src = "\
  precision mediump float;\
  varying vec3 v_color;\
  void main(void) {\
    gl_FragColor = vec4(v_color, 1.0);\
  }\
  ";
  legacygl = get_legacygl(gl, vertex_shader_src, fragment_shader_src);
  legacygl.add_uniform("modelview", "Matrix4f");
  legacygl.add_uniform("projection", "Matrix4f");
  legacygl.add_vertex_attribute("color", 3);
  legacygl.vertex2 = function(p) {
    this.vertex(p[0], p[1], 0);
  };
  drawutil = get_drawutil(gl, legacygl);
  camera = get_camera(canvas.width);
  camera.eye = [0, 0, 7];

  // ポイントたちを初期化
  // points.push([-0.5, -0.6]);
  // points.push([1.2, 0.5]);
  // points.push([-0.4, 1.3]);
  // points.push([-0.4, 1.0]);

  // event handlers
  canvas.onmousedown = function(evt) {
    // 右クリックの時に選択画面は出るけど点は動かないようにする
    if (evt.button === 0) {
      ispointmove = true;
    }

    let mouse_win = this.get_mousepos(evt);
    if (evt.altKey) {
      camera.start_moving(mouse_win, evt.shiftKey ? "zoom" : "pan");
      return;
    }
    // pick nearest object

    let viewport = [0, 0, canvas.width, canvas.height];
    let dist_min = 10000000;
    for (let i = 0; i < points.length; ++i) {

      let object_win = glu.project([points[i][0], points[i][1], 0], 
        legacygl.uniforms.modelview.value,
        legacygl.uniforms.projection.value,
        viewport);
      let dist = vec2.dist(mouse_win, object_win);
      if (dist < dist_min) {
        dist_min = dist;
        selected = i;
      }
    }
  };

  // Context Menu! Right click.
  canvas.oncontextmenu = function (e){
    // 右クリックしたときのマウスの位置を取得
    right_click_mouse_pos = this.get_mousepos(e);
    console.log(right_click_mouse_pos);
  };

  canvas.onmousemove = function(evt) {
    let mouse_win = this.get_mousepos(evt);
    if (camera.is_moving()) {
      camera.move(mouse_win);
      draw();
      return;
    }

    if (ispointmove) {
      // マウスのポジションを取得するためのhelper function  
      let mouse_obj = getMousePos(mouse_win);

      // just reuse the same code as the 3D case
      let plane_origin = [0, 0, 0];
      let plane_normal = [0, 0, 1];
      let eye_to_mouse = numeric.sub(mouse_obj, camera.eye);
      let eye_to_origin = numeric.sub(plane_origin, camera.eye);
      let s1 = numeric.dot(eye_to_mouse, plane_normal);
      let s2 = numeric.dot(eye_to_origin, plane_normal);
      let eye_to_intersection = numeric.mul(s2 / s1, eye_to_mouse);
      vec2.copy(points[selected], numeric.add(camera.eye, eye_to_intersection));
      draw();
    }
  }

  document.onmouseup = function (evt) {
    if (camera.is_moving()) {
      camera.finish_moving();
      return;
    }

    ispointmove = false;
  };
  // init OpenGL settings
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(1, 1, 1, 1);
};

function deleteVertex (e) {
  console.log(selected);
  points.splice(selected, 1);
  draw();
};

function addVertex (e) {
  let mouse_obj = getMousePos(right_click_mouse_pos);
  points.push(mouse_obj);
  draw();
};
