let gl;
let canvas;
let legacygl;
let drawutil;
let camera;

// 画面上にあるCurveのインスタンス
let curves = [];
// 本当にselected
let selected_cont_itr;
let selected_cont_point;
let selected_cont_bezier;
// 一番近い制御点
let nearest_cont_itr;
let nearest_cont_point;
let nearest_cont_bezier;
// 一番近いベジェ曲線の点
let nearest_bez_itr;
let nearest_bez_point;
let nearest_bez_bezier;
// 右クリックを押したときのマウスの位置、ポイントを追加する為に必要
let right_click_mouse_pos;
// マウスムーブのポジションを常に持ってく
let mouse_move_pos;
// ポイントが動くモードに入っているか
let ispointmove = false;

class Curve {
  constructor () {
    this.points = [];
    // カーブを分割するt
    this.curve = [];
  }

  // Used for Bezier curve
  deCas (i, j, t) {
    if (i === 0) {
      return this.points[j];
    }

    const res = numeric.add(numeric.mul(1-t, this.deCas(i-1,j,t)), numeric.mul(t, this.deCas(i-1,j+1,t)));
    return res;
  }

  eval_quadratic_bezier(t) {
    // 元のコード
    // return numeric.add(numeric.mul(1 - t, p0), numeric.mul(t, p2));

    // Two dimension bezier curve. 二次ベジェ曲線
    // return numeric.add(numeric.add(numeric.mul(numeric.mul(1-t,1-t), p0),
    //  numeric.mul(2, numeric.mul(t, numeric.mul((1-t), p1)))), numeric.mul(numeric.mul(t,t), p2));
    //
    // n次ベジェ曲線
    return this.deCas(this.points.length - 1, 0, t);
  }
}

function calc_percent(bez_temp, numsteps) {
  percent = []
  for (let i = 1; i <= numsteps - 1; ++i) {
    const a = bez_temp[i-1][0];
    const b = bez_temp[i][0];
    const c = bez_temp[i+1][0];

    const ab = Math.sqrt(Math.pow(a[0] - b[0], 2) + Math.pow(a[1] - b[1], 2));
    const ac = Math.sqrt(Math.pow(a[0] - c[0], 2) + Math.pow(a[1] - c[1], 2));
    const bc = Math.sqrt(Math.pow(b[0] - c[0], 2) + Math.pow(b[1] - c[1], 2));

    const t = numeric.dot(numeric.sub(a, b), numeric.sub(c, b));
    const cos = t / (bc * ab);

    percent.push(-Math.acos(cos));
  }
  return percent;
}

function draw() {
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  // projection & camera position
  mat4.perspective(legacygl.uniforms.projection.value, Math.PI / 6, canvas.aspect_ratio(), 0.1, 1000);
  let modelview = legacygl.uniforms.modelview;
  camera.lookAt(modelview.value);

  // xy grid
  gl.lineWidth(1);
  legacygl.color(0.5, 0.5, 0.5);
  drawutil.xygrid(100);

  for (let b = 0; b < curves.length; b++) {
    curves[b].curve = [];
  }

  // draw line segments composing curve
  legacygl.color(1, 0.6, 0.2);
  let numsteps = Number(document.getElementById("input_numsteps").value);

  let mul = numeric.mul;
  let add = numeric.add;
  let sub = numeric.sub;
  if (document.getElementById("input_bsp_3").checked) {
    // 3次元Bスプライン
    for (let c = 0; c < curves.length; c++) {
      legacygl.begin(gl.LINE_STRIP);
      let num_points = curves[c].points.length;

      for (let tt = 3.0; tt < num_points; tt+=0.001) {
        const i = Math.floor(tt);
        const t = tt - i;
        let p0 = curves[c].points[i - 3];
        let p1 = curves[c].points[i - 2];
        let p2 = curves[c].points[i - 1];
        let p3 = curves[c].points[i];

        let point = [0,0];

        const t2 = t * t;
        const t3 = t2 * t;
        const mt3 = (1 - t) * (1 - t) * (1 - t);

        const bi3 = mt3 / 6;
        const bi2 = ((3 * t3) - (6 * t2) + 4) / 6;
        const bi1 = ((-3 * t3) + (3 * t2) + (3 * t) + 1) / 6;
        const bi  = t3 / 6;

        point = add(add(mul(p0, bi3), mul(p1, bi2)), add(mul(p2, bi1), mul(p3, bi)));

        curves[c].curve.push(point);
        legacygl.vertex2(point);
      }
      legacygl.end();
    }
  } else if (document.getElementById("input_bsp_2").checked) {
    // 二次元Bスプライン
    for (let c = 0; c < curves.length; c++) {
      legacygl.begin(gl.LINE_STRIP);
      let num_points = curves[c].points.length;

      for (let tt = 3.0; tt < num_points; tt+=0.001) {
        const i = Math.floor(tt);
        const t = tt - i;
        let p0 = curves[c].points[i - 2];
        let p1 = curves[c].points[i - 1];
        let p2 = curves[c].points[i];

        let point = add(add(mul(1/2, mul(add(Math.pow(t,2), add(mul(-2, t), 1)), p0)), mul(1/2, mul(p1, add(add(mul(-2, Math.pow(t,2)), mul(2, t)) , 1)))), mul(1/2, mul(p2, Math.pow(t,2))));

        curves[c].curve.push(point);
        legacygl.vertex2(point);
      }
    }
    legacygl.end();
  } else if (document.getElementById("input_catmull_rom").checked) {
    // Catmull Rom
    for (let c = 0; c < curves.length; c++) {
      legacygl.begin(gl.LINE_STRIP);
      let num_points = curves[c].points.length;

      for (let j = 0; j <= numsteps; ++j) {
        let t = j / numsteps;

        // 始点
        let p0 = curves[c].points[0];
        let p1 = curves[c].points[1];
        let p2 = curves[c].points[2];
        let point_first = mul(1/2, add(mul(add(p0, add(mul(-2, p1), p2)), Math.pow(t,2)), add(mul(add(mul(-3, p0), add(mul(4, p1), mul(-1, p2))), t), mul(2, p0))));
        curves[c].curve.push(point_first);
        legacygl.vertex2(point_first);
      }

      // それ以外の点
      for (let i = 3; i < num_points; i++) {
        for (let j = 0; j <= numsteps; ++j) {
          let t = j / numsteps;
          let p0 = curves[c].points[i - 3];
          let p1 = curves[c].points[i - 2];
          let p2 = curves[c].points[i - 1];
          let p3 = curves[c].points[i];

          let eval_cat0 = mul(mul(1/2, (add(add(mul(-1, p0), mul(3, p1)), add(mul(-3, p2), p3)))), Math.pow(t,3));
          let eval_cat1 = mul(mul(1/2, (add(add(mul(2, p0), mul(-5, p1)), add(mul(4, p2), mul(-1, p3))))), Math.pow(t,2));
          let eval_cat2 = mul(t, mul(1/2, add(mul(-1, p0), p2)));
          let point = add(add(eval_cat0, eval_cat1), add(eval_cat2, p1));

          curves[c].curve.push(point);
          legacygl.vertex2(point);
        }
      }

      // 終点
      p0 = curves[c].points[num_points - 3];
      p1 = curves[c].points[num_points - 2];
      p2 = curves[c].points[num_points - 1];
      for (let j = 0; j <= numsteps; ++j) {
        let t = j / numsteps;
        let point_last = mul(1/2, add(mul(add(p0, add(mul(-2, p1), p2)), Math.pow(t,2)), add(mul(add(mul(-1, p0), p2), t), mul(2, p1))));
        curves[c].curve.push(point_last);
        legacygl.vertex2(point_last);
      }

      legacygl.end();
    }
  } else if (document.getElementById("input_bezier").checked) {
    // Bezier curve!
    for (let bez = 0; bez < curves.length; bez++) {
      legacygl.begin(gl.LINE_STRIP);

      bez_temp = []
      for (let i = 0; i <= numsteps; ++i) {
        let t = i / numsteps;
        const point = curves[bez].eval_quadratic_bezier(t);
        bez_temp.push([point, t]);
      }

      // Adaptive samplingがオンになっていたら
      const as_steps = Number(document.getElementById("input_as_steps").value);
      if (document.getElementById("input_adaptive_sampling").checked) {
        // a, b, cという三角形でbが中点だと考える。中点から底辺への高さと底辺の比を考え、
        // それが一定以上だったらadaptiveにtを追加する。
        for (let i = 0; i < as_steps; i++) {
          let percent = calc_percent(bez_temp, numsteps);

          const max_index = percent.indexOf(Math.max.apply(null, percent)) + 1;

          // 曲率が高い点にtを追加
          const new_t_1 = (2*(bez_temp[max_index - 1][1]) + bez_temp[max_index + 1][1]) / 3;
          const new_t_2 = (bez_temp[max_index - 1][1] + 2*(bez_temp[max_index + 1][1])) / 3;
          const new_point_1 = curves[bez].eval_quadratic_bezier(new_t_1);
          const new_point_2 = curves[bez].eval_quadratic_bezier(new_t_2);
          bez_temp.splice(max_index, 1, [new_point_1, new_t_1], [new_point_2, new_t_2]);

          percent = calc_percent(bez_temp, numsteps+1);
          let min = percent.indexOf(Math.min.apply(null, percent)) + 1;
          // 曲率が低い点を削除
          bez_temp.splice(min, 1);
        }
      }

      for (let i = 0; i <= numsteps; ++i) {
        curves[bez].curve.push(bez_temp[i][0]);
        legacygl.vertex2(curves[bez].curve[i]);
      }
      legacygl.end();
    }
  }

  // draw sample points
  if (document.getElementById("input_show_samplepoints").checked) {
    for (let b = 0; b < curves.length; b++) {
      legacygl.begin(gl.POINTS);
      for (let i = 0; i < curves[b].curve.length; ++i) {
        // 選択された点はハイライトする
        if (i === nearest_bez_itr && b === nearest_bez_bezier) {
          legacygl.color(0.9, 0, 0);
          legacygl.vertex2(curves[b].curve[i]);
          legacygl.color(1, 0.6, 0.2);
        } else {
          legacygl.vertex2(curves[b].curve[i]);
        }
      }
      legacygl.end();
    }
  }

  // draw control points
  if (document.getElementById("input_show_controlpoints").checked) {
    legacygl.color(0.2, 0.5, 1);
    for (let b = 0; b < curves.length; b++) {
      legacygl.begin(gl.LINE_STRIP);
      for (let i = 0; i < curves[b].points.length; i++) {
        legacygl.vertex2(curves[b].points[i]);
      }
      legacygl.end();
    }

    for (let b = 0; b < curves.length; b++) {
      legacygl.begin(gl.POINTS);
      for (let i = 0; i < curves[b].points.length; i++) {
        if (i === nearest_cont_itr && b == nearest_cont_bezier) {
          legacygl.color(0.9, 0, 0);
          legacygl.vertex2(curves[b].points[i]);
          legacygl.color(0.2, 0.5, 1);
        } else {
          legacygl.vertex2(curves[b].points[i]);
        }
      }
      legacygl.end();
    }
  }
};

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

  // ベジェ曲線を初期化
  // ポイントたちを初期化
  curves.push(new Curve());
  curves[0].points.push([-0.5, -0.6]);
  curves[0].points.push([1.2, 0.5]);
  curves[0].points.push([-0.4, 1.3]);

  // マウスが押された時
  canvas.onmousedown = function(evt) {
    // 右クリックの時に選択画面は出るけど点は動かないようにする
    if (evt.button === 0) {
      ispointmove = true;
    }

    selected_cont_bezier = nearest_cont_bezier;
    selected_cont_itr = nearest_cont_itr;
    selected_cont_point = nearest_cont_point;

    let mouse_win = this.get_mousepos(evt);
    if (evt.altKey) {
      camera.start_moving(mouse_win, evt.shiftKey ? "zoom" : "pan");
      return;
    }
  };

  // 右クリックでcontext menu
  canvas.oncontextmenu = function (e){
    // 右クリックしたときのマウスの位置を取得
    right_click_mouse_pos = this.get_mousepos(e);
  };

  canvas.onmousemove = function(evt) {
    mouse_move_pos = this.get_mousepos(evt);
    if (camera.is_moving()) {
      camera.move(mouse_move_pos);
      draw();
      return;
    }

    // マウスを近くにするだけで、一番近い制御点がハイライトされるようにする
    [nearest_cont_bezier, nearest_cont_itr, nearest_cont_point] = findNearestPoint(mouse_move_pos);
    // マウスに一番近いベジェ曲線上の点
    [nearest_bez_bezier, nearest_bez_itr, nearest_bez_point] = findNearestCurve(mouse_move_pos);

    if (ispointmove) {
      // マウスのポジションを取得するためのhelper function  
      let mouse_obj = getMousePos(mouse_move_pos);
      vec2.copy(selected_cont_point, numeric.add(camera.eye, mouse_obj));
    }
    draw();
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
