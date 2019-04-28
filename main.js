let gl;
let canvas;
let legacygl;
let drawutil;
let camera;

// 画面上にあるBezierのインスタンス
let beziers = [];
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

class Bezier {
  constructor () {
    this.points = [];
    // カーブを分割するt
    this.curve = [];
  }

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

  for (let b = 0; b < beziers.length; b++) {
    beziers[b].curve = [];
  }

  // draw line segments composing curve
  legacygl.color(1, 0.6, 0.2);
  let numsteps = Number(document.getElementById("input_numsteps").value);
  for (let b = 0; b < beziers.length; b++) {
    legacygl.begin(gl.LINE_STRIP);
    for (let i = 0; i <= numsteps; ++i) {
      let t = i / numsteps;
      beziers[b].curve.push([beziers[b].eval_quadratic_bezier(t), t]);
      legacygl.vertex2(beziers[b].curve[i][0]);
    }
    legacygl.end();
  }

  // draw sample points
  if (document.getElementById("input_show_samplepoints").checked) {
    for (let b = 0; b < beziers.length; b++) {
      legacygl.begin(gl.POINTS);
      for (let i = 0; i <= numsteps; ++i) {
        // 選択された点はハイライトする
        if (i === nearest_bez_itr && b === nearest_bez_bezier) {
          legacygl.color(0.9, 0, 0);
          legacygl.vertex2(beziers[b].curve[i][0]);
          legacygl.color(1, 0.6, 0.2);
        } else {
          legacygl.vertex2(beziers[b].curve[i][0]);
        }
      }
      legacygl.end();
    }
  }

  // draw control points
  if (document.getElementById("input_show_controlpoints").checked) {
    legacygl.color(0.2, 0.5, 1);
    for (let b = 0; b < beziers.length; b++) {
      legacygl.begin(gl.LINE_STRIP);
      for (let i = 0; i < beziers[b].points.length; i++) {
        legacygl.vertex2(beziers[b].points[i]);
      }
      legacygl.end();
    }

    for (let b = 0; b < beziers.length; b++) {
      legacygl.begin(gl.POINTS);
      for (let i = 0; i < beziers[b].points.length; i++) {
        if (i === nearest_cont_itr && b == nearest_cont_bezier) {
          legacygl.color(0.9, 0, 0);
          legacygl.vertex2(beziers[b].points[i]);
          legacygl.color(0.2, 0.5, 1);
        } else {
          legacygl.vertex2(beziers[b].points[i]);
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
  beziers.push(new Bezier());
  beziers[0].points.push([-0.5, -0.6]);
  beziers[0].points.push([1.2, 0.5]);
  beziers[0].points.push([-0.4, 1.3]);

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

function deleteVertex (e) {
  beziers[nearest_cont_bezier].points.splice(nearest_cont_itr, 1);
  draw();
};

function addVertex (e) {
  let mouse_obj = getMousePos(right_click_mouse_pos).slice(0, 2);

  // マウスの位置と線の距離が一定以下の場合は、線上に制御点を追加する
  // 一定以上の場合は、0とpoints.lengthの近い方にくっつける
  let min_length_to_line = 1000000;
  let nearest_to_line = 0;
  let added_b;
  for (let b = 0; b < beziers.length; b++) {
    for (let i = 0; i < beziers[b].points.length - 1; i++ ) {
      const v_a = numeric.sub(mouse_obj, beziers[b].points[i]);
      const v_b = numeric.sub(beziers[b].points[i+1], beziers[b].points[i]);

      const dot_product = numeric.dot(v_a, v_b);
      const vec_length = numeric.div(dot_product, numeric.dot(v_b, v_b));

      if (vec_length > 1 || vec_length < 0) {
      } else {
        const vec_c = numeric.sub(numeric.mul(v_b, vec_length), v_a);
        const dot = numeric.dot(vec_c, vec_c);
        if (min_length_to_line > dot) {
          min_length_to_line = dot;
          nearest_to_line = i;
          added_b = b;
        }
      }
    }
  }

  beziers[added_b].points.splice(nearest_to_line + 1, 0, mouse_obj);
  draw();
};

function newCurve (e) {
  beziers.push(new Bezier());
  const mouse_obj = getMousePos(right_click_mouse_pos).slice(0, 2);
  beziers[beziers.length - 1].points.push(mouse_obj);
  beziers[beziers.length - 1].points.push([mouse_obj[0] - 0.1, mouse_obj[1] - 0.1]);

  draw();
};

function splitCurve (e) {
  const cur_bez = beziers[nearest_bez_bezier];
  const t = cur_bez.curve[nearest_bez_itr][1];

  const new_p0 = cur_bez.deCas(cur_bez.points.length - 2, 0, t);
  const new_p1 = cur_bez.deCas(cur_bez.points.length - 1, 1, t);

  let new_bez_1 = new Bezier();
  let new_bez_2 = new Bezier();
  beziers.push(new_bez_1);
  beziers.push(new_bez_2);

  new_bez_2.points.push(nearest_bez_point);
  for (let i = 0; i < cur_bez.points.length; i++) {
    if (cur_bez.points[i] < cur_bez.points.length - 2) {
      new_bez_1.points.push(cur_bez.points[i]);
    } else if (cur_bez.points[i] > 1) {
      new_bez_2.points.push(cur_bez.points[i])
    }
  }
  new_bez_1.points.push(nearest_bez_point);
  
  beziers.splice(nearest_bez_bezier, 1);

  draw();
};

// Combination
function productRange (a,b) {
  let prd = a;
  let i = a;
  while (i++< b) {
    prd*=i;
  }
  return prd;
}

function combinations(n, r) {
  if (n==r) {
    return 1;
  } else {
    r=(r < n-r) ? n-r : r;
    return productRange(r+1, n)/productRange(1,n-r);
  }
}

function getMousePos (mouse_win) {
  mouse_win.push(1);

  let mouse_obj = glu.unproject(mouse_win, 
    legacygl.uniforms.modelview.value,
    legacygl.uniforms.projection.value,
    [0, 0, canvas.width, canvas.height]);

  // just reuse the same code as the 3D case
  let plane_origin = [0, 0, 0];
  let plane_normal = [0, 0, 1];
  let eye_to_mouse = numeric.sub(mouse_obj, camera.eye);
  let eye_to_origin = numeric.sub(plane_origin, camera.eye);
  let s1 = numeric.dot(eye_to_mouse, plane_normal);
  let s2 = numeric.dot(eye_to_origin, plane_normal);
  return eye_to_intersection = numeric.mul(s2 / s1, eye_to_mouse);

}

function findNearestPoint (mouse_win) {
  let viewport = [0, 0, canvas.width, canvas.height];
  let dist_min = 10000000;
  let nearest_itr;
  let nearest_point;
  let nearest_bezier;
  for (let b = 0; b < beziers.length; b++) {
    for (let i = 0; i < beziers[b].points.length; ++i) {
      let object_win = glu.project([beziers[b].points[i][0], beziers[b].points[i][1], 0], 
        legacygl.uniforms.modelview.value,
        legacygl.uniforms.projection.value,
        viewport);
      let dist = vec2.dist(mouse_win, object_win);
      if (dist < dist_min) {
        dist_min = dist;
        nearest_itr = i;
        nearest_bezier = b;
        nearest_point = beziers[b].points[i];
      }
    }
  }

  return [nearest_bezier, nearest_itr, nearest_point];
}

function findNearestCurve (mouse_win) {
  let viewport = [0, 0, canvas.width, canvas.height];
  let dist_min = 10000000;
  let nearest_itr;
  let nearest_point;
  let nearest_bezier;
  for (let b = 0; b < beziers.length; b++) {
    for (let i = 0; i < beziers[b].curve.length; ++i) {
      let object_win = glu.project([beziers[b].curve[i][0][0], beziers[b].curve[i][0][1], 0], 
        legacygl.uniforms.modelview.value,
        legacygl.uniforms.projection.value,
        viewport);
      let dist = vec2.dist(mouse_win, object_win);
      if (dist < dist_min) {
        dist_min = dist;
        nearest_itr = i;
        nearest_bezier = b;
        nearest_point = beziers[b].curve[i][0];
      }
    }
  }

  return [nearest_bezier, nearest_itr, nearest_point];
}
