

// потому что браузер ругается на: <script type="module" src="DAG.js"></script>
// в итоге после вызова этой функии на my_widget_button остается висеть addEventListener('click')
(function() {


function generate_new_label(i) {  // а-ля перевод в ('z'-'a'+1)-ричную систему исчисления
    // почему то нельзя делать: 'a' + k  (втф?)
    let alphabet = 'abcdefghijklmnopqrstuvwxyz';
    let L = alphabet.length;

    let text = (i == 0) ? 'a' : '';
    while( i ) {
        text += alphabet  [ i%L ];
        i     = Math.floor( i/L ); // какой же треш, целочисленого деления нет
    }
    // какой ужас... Почему нет просто reverse-то??
    return text.split('').reverse().join('')
}

function draw_segment(draw_ctx, x1, y1, x2, y2, line_width = 1, clr = 'black') {
    draw_ctx.lineWidth   = line_width;
    draw_ctx.strokeStyle = clr;
    draw_ctx.beginPath();
    draw_ctx.moveTo(x1, y1);
    draw_ctx.lineTo(x2, y2);
    draw_ctx.stroke();
}



let canvas_W = 800, canvas_H = 300;

// тут типо ДЕКОМПОЗИЦИЯ: здесь всё что связано с рисованием
// !!! Edges !!! Label_texts !!! - используются вне этого класса
class GraphDrawing {
    // (отмена): че бы не сделать ctrl+Z для Yc??? лул (kek - если эти же клавиши набирать с английской раскладкой)
    Xc           = [];
    Yc           = [];
    
    Label_width  = [];
    Label_texts  = [];  // Label_texts[i][0] - название вершины, Label_texts[i][1] - доп. инфо

    Edges        = [];
    
    // path храниться тут (а не в классе GraphRecorder), потому что у прошлых кадров мы можем менять положение вершин, а для этого надо знать какой путь выделять
    Vertex_path       = [];
    Vertex_path_color = 'purple';
    
    Canvas = new OffscreenCanvas(canvas_W, canvas_H);
    Ctx    = this.Canvas.getContext('2d');

    
    constructor(edges, label_texts = null) {  // этот конструктор тоже "завладевает" данными
        if( label_texts == null ) {
            label_texts = [];
            for(let i = 0; i < edges.length; i++) label_texts.push( [generate_new_label(i), ""] );
        }
        this.Edges       =       edges;
        this.Label_texts = label_texts;
    }

    light_cloning() {
        return new GraphDrawing( structuredClone(this.Edges), structuredClone(this.Label_texts) );
    }



// ===== [ STATIC ] (для рисования) =========================================================================
    // static - метод, хранимый "единожды", для всех экземпляров класса
    static label_H = 30;  // вертикальный размер для label-а (подогнан)
    static get_label_width(draw_ctx, txt1, txt2) {
        draw_ctx.textAlign    = "center";
        draw_ctx.textBaseline = "middle";
        draw_ctx.font         = '14px Arial';
        return 1.2 * Math.max(draw_ctx.measureText(txt1).width, draw_ctx.measureText(txt2).width);
    }
    
    // а тут захардкожено, что это именно две строки :)))
    // static label_H_shift = -0.05*this.label_H;
    static draw_label(draw_ctx, xc, yc, w, txt_line_1, txt_line_2) {
        draw_ctx.textAlign    = "center";
        draw_ctx.textBaseline = "middle";
        draw_ctx.font         = '14px Arial';
        draw_ctx.fillStyle    = 'white';
        draw_ctx.fillRect  (xc - w/2, yc - GraphDrawing.label_H/2, w, GraphDrawing.label_H);
        
        draw_ctx.fillStyle    = 'black';
        draw_ctx.fillText  (txt_line_1, xc, yc + GraphDrawing.label_H*0.05 - 7);
        draw_ctx.fillText  (txt_line_2, xc, yc + GraphDrawing.label_H*0.05 + 7);
        draw_ctx.lineWidth    = 1;
        draw_ctx.strokeStyle  = 'black';
        draw_ctx.strokeRect(xc - w/2, yc - GraphDrawing.label_H/2, w, GraphDrawing.label_H);
    }

    // static highlight_edge(draw_ctx, x1, y1, x2, y2, path_color) { }

    static draw_edge(draw_ctx, x1, y1, x2, y2, cnt) {
        draw_segment(draw_ctx, x1, y1, x2, y2, cnt);

        // стрелочка
        draw_ctx.lineWidth = 1;
        let a     = 15, ofset = 50;
        let angle = 20 * Math.PI/180; 

        let dx = x2 - x1, dy = y2 - y1, dl  = Math.sqrt(dx*dx + dy*dy), scale = a/dl;
        let sin_a  = Math.sin(angle), cos_a = Math.cos(angle);
        let new_dx1 = scale * ( -dx*cos_a + dy*sin_a ), new_dy1 = scale * ( -dx*sin_a - dy*cos_a );
        let new_dx2 = scale * ( -dx*cos_a - dy*sin_a ), new_dy2 = scale * (  dx*sin_a - dy*cos_a );
        // let to_x = x2 - dx * (ofset/dl), to_y = y2 - dy * (ofset/dl);
        let to_x = x2 - dx/4, to_y = y2 - dy/4;
        draw_ctx.beginPath();
        draw_ctx.moveTo(to_x, to_y);
        draw_ctx.lineTo(to_x + new_dx1, to_y + new_dy1);
        draw_ctx.lineTo(to_x + new_dx2, to_y + new_dy2);
        draw_ctx.closePath();
        draw_ctx.fill();
    }
// ==========================================================================================================


    // [TIER 1] Вычисление координат по топологии (блен, полезно оставлять комментыы)
    // предполагается ЕДИНСТВЕНЫЙ вызов этой функции когда закончили изменять граф - ай, ладно пускай будет одна функция которая тупо всё сразу делает
    recalc_graph_base(cnt_in, cnt_reveal) {  // ай, cnt_in конечно можно было бы внутри вычсилить, но ладно, будем передавать - так меньше строчек
        let N = this.Edges.length;
        let cords_j = new Int32Array(N);  // положение на уровне
        let cords_h = new Int32Array(N);  // глубина уровня
        
        //   I. Раздаём BFS-ом глубины
        let layer        = [ 0 ];
        let height       =   0;
        let cnt_need_in  = [...cnt_in];
        while( layer.length ) {
            let next_layer = [];

            for(let vertex of layer) {
                // cords_j[vertex] = j; - как альтернативный вариант задания координат (upd, ну надо тогда for(let j = 0; ...) писать)
                cords_h[vertex] = height;

                for(let [nxt] of this.Edges[vertex]) {
                    if( --cnt_need_in[nxt] == 0 ) next_layer.push(nxt);
                }
            }

            layer = next_layer;
            height++;
        }

        //  II. DFS - чтобы вершины в слое шли "по порядку" (ХЗ - нужно ли так, или bfs лучше - скорее после комита точно снесу эту часть чтобы строчек было мнеьше ыыыы)
        let cnt_on_layer = new Int32Array(height);  // количество вершин на уровне
        let visited      = new Int32Array(     N);
        // спс: Замените обычную функцию dfs на стрелочную, которая автоматически захватывает внешний this (экземпляр GraphDrawing):
        const dfs = (vertex) => {
            visited[vertex] = 1;
            cords_j[vertex] = cnt_on_layer[cords_h[vertex]]++;

            for(let [nxt] of this.Edges[vertex]) {
                if( !visited[nxt] ) dfs(nxt);
            }
        }
        dfs(0);

        // III. Вычисляем координаты:  cords_j -> Yc,  cords_h -> Xc
        for(let i = 0; i < N; i++) {
            let [j, h] = [cords_j[i], cords_h[i]];
            // (порядок слегка перевёрнутый - потому что рисуем "уровни" горизонтально)
            cords_j[i] = canvas_H* (j+1) / (cnt_on_layer [h]   +1);
            cords_h[i] = canvas_W* (h+1) / (cnt_on_layer.length+1);
        }
        this.Xc = cords_h;
        this.Yc = cords_j;


        //  IV. "Пересчёт" Label-ов
        for(let i = 0; i < N; i++) {
            this.Label_texts[i][1] = "[" + String(i) + "] " + String(cnt_reveal[i]);
            this.Label_width.push( GraphDrawing.get_label_width(this.Ctx, ...this.Label_texts[i]) );
        }
    }



    highlight_path(draw_ctx, path, ignored_vertex, is_highlighting_last_vertex = 1) {
        // ПЛАК ПЛАК ПЛАК - достаточный плагиат redraw_canvas (комент из draw_movable_vertex). АХАХАХАХ - уже НЕТ!!! Теперь это отдельная функция! Ну неплохо неплохо (ОСОБЕНО всравнении с былым!)
        if( !path.length ) return;

        draw_ctx.  fillStyle = this.Vertex_path_color;
        draw_ctx.strokeStyle = this.Vertex_path_color;

        // "выделение" финальной вершины на пути
        let last_vertex = path[path.length-1];
        if( is_highlighting_last_vertex && last_vertex != ignored_vertex ) {
            let [xcl, ycl, wl] = [this.Xc[last_vertex], this.Yc[last_vertex], this.Label_width[last_vertex]];  // эхх, было бы круто вынести [last_indx] за "скобки"
            draw_ctx.fillRect( xcl - 1.2*wl/2, ycl - 1.2*GraphDrawing.label_H/2, 1.2*wl, 1.2*GraphDrawing.label_H );
        }
        
        // Рёбра на пути
        draw_ctx.globalAlpha = 0.5;
        draw_ctx.lineWidth   = 5;
        draw_ctx.beginPath();
        let prev_drawed = 0;
        let debug = "debug: ";
        for(let i of path) {
            if( i == ignored_vertex ) { debug += " (skip " + String(i) + ")"; prev_drawed = 0; continue; }
            debug += " (" + (prev_drawed ? "-> " : "| ") + String(i) + ")";

            let [x, y] = [this.Xc[i], this.Yc[i]];
            if( !prev_drawed ) draw_ctx.moveTo(x, y);
            else               draw_ctx.lineTo(x, y);
            prev_drawed = 1;
        }
        draw_ctx.stroke();
        draw_ctx.globalAlpha = 1;

        // console.log(debug);
    }

    Skiped_vertex = -1;
    // аргумент ф-ии:  * skiped_vertex == -2  -  используется this.Skiped_vertex
    //                 * иначе переключаемся на вершину skiped_vertex (в частности если будет значение -1 - то никакая вершина не пропустится)
    redraw_canvas(skiped_vertex = -2) {  
        // Рил, пусть будет "переключалка" / "запоминалка"
        if( skiped_vertex == -2 )      skiped_vertex = this.Skiped_vertex;
        else                      this.Skiped_vertex =      skiped_vertex;  // ыхых, а можно и удалить разветвление (удалить только слово "else")

        this.Ctx.clearRect(0, 0, canvas_W, canvas_H);

        // Рёбра
        for(let i = 0; i < this.Edges.length; i++) {
            if( i == skiped_vertex ) continue;
            for(let [j, cnt] of this.Edges[i]) {
                if( j == skiped_vertex ) continue;
                GraphDrawing.draw_edge(this.Ctx, this.Xc[i], this.Yc[i], this.Xc[j], this.Yc[j], cnt);
            }
        }

        // Выделям/подсвечиваем Vertex_path
        this.highlight_path(this.Ctx, this.Vertex_path, skiped_vertex);
        
        // Названия вершин
        for(let i = 0; i < this.Label_texts.length; i++) {
            if( i == skiped_vertex ) continue;
            GraphDrawing.draw_label(this.Ctx, this.Xc[i], this.Yc[i], this.Label_width[i], ...this.Label_texts[i]);
        }
    }
    

    // этот вызов должен быть ещё в displace_to
    // вызываем только для последнего актуального GraphDrawing
    change_vertex_path(path, path_color = null) {
        this.Vertex_path       = structuredClone(path);
        this.Vertex_path_color = (path_color == null) ? 'rgba(100, 180, 255)' : path_color;
        this.redraw_canvas();
    }


    InEdges = [];
    Skiped_vertex_releating_path = [];
    start_move_vertex(vertex_indx) {
        this.redraw_canvas(vertex_indx);

        this.InEdges = [];
        for(let i = 0; i < this.Edges.length; i++) {
            for(let [j, cnt] of this.Edges[i]) {
                if( j == vertex_indx ) {
                    this.InEdges.push( [i, cnt] );
                    break;
                }
            }
        }

        this.Skiped_vertex_releating_path = [];
        for(let p = 0; p < this.Vertex_path.length; p++) {
            if( this.Vertex_path[p] == vertex_indx ) {
                if( p-1 >= 0 )                      this.Skiped_vertex_releating_path.push( this.Vertex_path[p-1] );
                                                    this.Skiped_vertex_releating_path.push( this.Vertex_path[p  ] );
                if( p+1 < this.Vertex_path.length ) this.Skiped_vertex_releating_path.push( this.Vertex_path[p+1] );
                break;
            }
        }

        console.log("Skiped_vertex_releating_path: ", this.Skiped_vertex_releating_path);
    }

    draw_movable_vertex(draw_ctx, dy) {
        let i = this.Skiped_vertex, xc = this.Xc[i], yc = this.Yc[i] + dy;
        this.Yc[i] += dy;  // эххх, всётаки уродство вышло :(

        // Ребра
        for(let [j, cnt] of this.Edges[i]) GraphDrawing.draw_edge(draw_ctx,      xc   ,      yc   , this.Xc[j], this.Yc[j], cnt);
        for(let [j, cnt] of this.InEdges ) GraphDrawing.draw_edge(draw_ctx, this.Xc[j], this.Yc[j],      xc   ,      yc   , cnt);

        // Подсвечивание Vertex_path (той части, которая проходит через Skiped_vertex)
        let L = this.Skiped_vertex_releating_path.length;
        if( L ) this.highlight_path(draw_ctx, this.Skiped_vertex_releating_path, -1, this.Skiped_vertex_releating_path[L-1] == i);

        // Название Вершины
        GraphDrawing.draw_label(draw_ctx, xc, yc, this.Label_width[i], ...this.Label_texts[i]);
        
        this.Yc[i] -= dy;  // эххх, всётаки уродство вышло :(
    }

    finish_move_vertex(total_dy) {
        this.Yc[this.Skiped_vertex] += total_dy;    

        this.redraw_canvas(-1);
    }


    which_vertex_covered(x, y) {
        for(let i = 0; i < this.Edges.length; i++) {
            let x1 = this.Xc[i] -         this.Label_width[i]/2, x2 = this.Xc[i] +         this.Label_width[i]/2;
            let y1 = this.Yc[i] - GraphDrawing.label_H       /2, y2 = this.Yc[i] + GraphDrawing.label_H       /2;
            if( x1 <= x && x <= x2 && y1 <= y && y <= y2 ) return i;
        }
        return -1;
    }
};




// ИСТОРИЯ CANVAS-ов (GraphRecorder - Ох, как же не хочется создавать класс, который будет по сути представлен единственным элементом)
class GraphRecorder {
    // class GraphDrawing {
    //     Xc         , Yc
    //     Label_width, Label_texts
    //     Vertex_path
    //     Edges
    // };

    // массив в котором храняться GraphDrawing (БАЛИИИН, ЭТО ТОЖЕ КАЖЕТСЯ БЫЛО ПРОЩЕ ПРОСТО МАССИВОМ МАССИВОВ СДЕЛАТЬ)
    HistoryDraw    = [];

    // было бы прикольно если на каждом canvas-е был свой "представитель". типа сделать ещё какой-то внутрений класс для этого. НО очев это только вообразить
    UsedCtx      = [];
    HistoryPoint = [];  // ахахахах, предполагется, что они будут указывать на РАЗНЫЕ HistoryDraw, не хочется тратить время на то, чтобы синхронизировать изменения сразу на нескольких cavnas-ах
    

    // Актуальная информация для последнего графа
    Cnt_reveal  = [  1 ];      // количество "путей" до вершины
    Cnt_in      = [  0 ];      // количество входящих рёбер от других вершин (без учёта кратности cnt) в вершину 


    // ССЫЛКА на МАССИВ (нет блин чтобы дать возможность ЯВНО указывать int&, нет надо именно знать что: "объекты всегда передаются и хранятся по ссылке.")
    Edges = [];
    N     =  0;  // количество вершин





    // ??? - проблема с пустым графом init_edges ???
    constructor(used_ctx0, used_ctx1, init_edges = []) {  // массив init_edges "забирается" (НУ БЛИН РЕАЛЬНО, БЫЛИ БЫ ТИПЫ)
        this.Edges = init_edges;
        this.N     = init_edges.length;
        
        this.Cnt_in     = new Array(this.N).fill(0);
        this.Cnt_reveal = new Array(this.N).fill(0);
        this.recalc_in(this.Cnt_in, this.Cnt_reveal);
        
        this.UsedCtx      = [used_ctx0, used_ctx1];
        this.HistoryPoint = [        1,         0];
        this.HistoryDraw = [ new GraphDrawing([]), new GraphDrawing(init_edges) ];
        this.HistoryDraw[1].recalc_graph_base(this.Cnt_in, this.Cnt_reveal);
        this.HistoryDraw[1].redraw_canvas();
    }

    // !!! TODO: убрать полный подсчёт путей cnt_reveal - и сделать только bool-ево: путь один или много
    recalc_in(cnt_in, cnt_reveal) {  // cnt_in, cnt_reveal - ссылки на массивы. Должны быть нужной длинны.
        cnt_in.fill(0);
        for(let i = 0; i < this.N; i++) {
            for(let [nxt, cnt] of this.Edges[i]) {  // тут вроде можно: for(let [nxt] of this.Edges[i])
                cnt_in[nxt]++;
            }
        }

        cnt_reveal.fill(0);
        cnt_reveal[0] = 1;
        
        // bfs пересчёт cnt_reveal (блин, прикольно было бы выделить "в итератор по контейнеру" bfs-обход, с передачей туда нужной функции)
        let cnt_need_in = [...cnt_in];
        let queue = [0], queue_pos = 0;
        while( queue_pos < queue.length ) {
            let vertex   = queue[queue_pos++];
            
            for(let [nxt, cnt] of this.Edges[vertex]) {
                cnt_reveal[nxt] += cnt_reveal[vertex] * cnt;
                if( --cnt_need_in[nxt] == 0 ) queue.push(nxt);
            }
        }
    }



    clear_ctx(scene_indx) { this.UsedCtx[scene_indx].clearRect(0, 0, canvas_W, canvas_H); }

    draw(scene_indx, path = null, path_color = null) {
        let curr_GraphDrawing = this.HistoryDraw[this.HistoryPoint[scene_indx]];
        if( path != null ) curr_GraphDrawing.change_vertex_path(path, path_color);

        this.UsedCtx[scene_indx].drawImage(curr_GraphDrawing.Canvas, 0, 0);
    }




    // клонирует последний "кадр" из HistoryDraw. Вернее только массивы Edges и Labels, ведь предполагается что другое будет пересчитываться. 
    cloning_last_scene() {
        let L = this.HistoryDraw.length;
        this.HistoryDraw.push( this.HistoryDraw[L-1].light_cloning() );
        
        // меняем ссылку
        this.Edges = this.HistoryDraw[L].Edges;

        // ЫХХЫХЫХ, захардкожено
        this.HistoryPoint[0] = L;
        this.HistoryPoint[1] = L-1;
    }
   


// === [ РАБОТАЕМ ТОЛЬКО С ПОСЛЕДНИМ элементом HistoryDraw ] ================================================
    // создаётся вершина с: cnt_reveal == 1  И  cnt_in == 0
    create_new_vertex(label) {
        this.Cnt_in    .push(  0 );
        this.Cnt_reveal.push(  1 );

        this.Edges     .push( [] );
        this.HistoryDraw[this.HistoryDraw.length-1].Label_texts.push( [label, ""] );
        return this.Edges.length - 1;
    }

    // УЖАС, А СТРОКИ НЕ ВОЗВРАЩАЮТСЯ ПО ССЫЛКЕ ПОДОБНО МАССИВУ. А ТАК ХОТЕЛОСЬ: vertex_label(i) += "_add"
    get_vertex_label(i)   { return this.HistoryDraw[this.HistoryDraw.length-1].Label_texts[i][0];       }
    set_vertex_label(i, txt)     { this.HistoryDraw[this.HistoryDraw.length-1].Label_texts[i][0] = txt; }
    
    get_modified_label(i) { return this.get_vertex_label(i) + "_" + String(this.HistoryDraw.length);    }


    // [TIER 1] Расслоение
    // блен, эту бы функцию выделить в отдельную (вне класса GraphRecorder), которая принимает только Edges, Cnt_in, Cnt_reveal
    branch_path(path) {  // расслоение
        let branch_start = -1;  // такой индекс, что: cnt[branch_start] > 1, а cnt[branch_start-1] == 1
        for(let i = 0; i < path.length; i++) {
            let vertex = path[i];
            if( this.Cnt_reveal[vertex] > 1 ) { branch_start = i; break; }

            // Вершины с cnt_reveal == 1  -  редактируем на месте
            this.set_vertex_label(vertex, this.get_modified_label(vertex));
        }

        // Все вершины на пути имеют cnt_reveal == 1  ->  выходим        
        if( branch_start == -1 ) return;
   

        // Остальную часть пути меняем (отщепляем вершины):  !!! PATH РЕДАКТИРУЕТСЯ !!!
        for(let i = branch_start; i < path.length; i++) {
            let vertex = path[i];

            // Создание новой вершины (отщепление от vertex)
            let new_vertex = this.create_new_vertex(this.get_modified_label(vertex));
            this.Edges[new_vertex] = structuredClone( this.Edges[vertex] );
            path[i] = new_vertex;

            // Ааааааааааа, нужно было только это, а не какой-то индуцированный граф
            this.Cnt_reveal[vertex]--;
            
            // Ищем номер ребра от prev_path_vertex к обычному vertex
            let    prev_vertex_egdes = this.Edges[path[i-1]],  edge_indx = 0;
            while( prev_vertex_egdes[edge_indx][0] != vertex ) edge_indx++;

            // Редактируем ребро на отщепленном пути (хотим: prev_path_vertex -> new_vertex)
            let cnt = prev_vertex_egdes[edge_indx][1];
            if( cnt == 1 ) {
                // перетираем ребро от (к обычному vertex) на (к new_vertex)
                prev_vertex_egdes[edge_indx][0] = new_vertex;
            } else {
                // уменьшаем кратность ребра (к обычному vertex)
                prev_vertex_egdes[edge_indx][1]--;
                
                // вставка ребра (к new_vertex)
                prev_vertex_egdes.splice(edge_indx, 0, [new_vertex, 1]);  // splice(i, delete_cnt, insert_x1, insert_x2, ...) - начиная с индекса i: удаление delete_cnt элементетов, и вставка (на их место) insert_x1, insert_x2, ... 
            }

            // Если сейчас branch_start, то значит прошлая вершина редактировалась НА МЕСТЕ, а не перекопировывалась в new_vertex. Значит мы должны поддерживать актуальным cnt_in которые прошлая вершина репродуцирует.
            if( i == branch_start ) {
                               this.Cnt_in[new_vertex]++;
                if( cnt == 1 ) this.Cnt_in[    vertex]--;
            }
        }
        
        // Обновляем cnt_in от отщеплённых вершин
        for(let i = branch_start; i < path.length; i++) {
            for(let [nxt] of this.Edges[path[i]]) this.Cnt_in[nxt]++;
        }
    }
// ==========================================================================================================



// === [ ПЕРЕТАСКИВАНИЕ ВЕРШИН ] ============================================================================
    DraggedVertex_SceneIndx = -1;  // <- только по ней проверять доступность "блока":  DraggedVertex_... (сама DraggedVertex хранится в соответствующем GraphDrawing)
    DraggedVertex_StartY    = -1;
    mouse_button_down(x, y, scene_indx) {
        let curr_GraphDrawing = this.HistoryDraw[this.HistoryPoint[scene_indx]];
        let covered_vertex    = curr_GraphDrawing.which_vertex_covered(x, y);
        
        console.log("[history=" + String(this.HistoryPoint[scene_indx]) + " scene_indx=" + scene_indx + "] covered_vertex:", covered_vertex);
        if( covered_vertex == -1 ) return;
        
        this.DraggedVertex_SceneIndx = scene_indx;
        this.DraggedVertex_StartY    = y;
        curr_GraphDrawing.start_move_vertex(covered_vertex);

        this.mouse_move_vertex(x, y, scene_indx);
    }

    mouse_move_vertex(x, y, scene_indx) {
        if( this.DraggedVertex_SceneIndx == -1 || scene_indx != this.DraggedVertex_SceneIndx ) return;

        this.clear_ctx(scene_indx);
        this.HistoryDraw[this.HistoryPoint[scene_indx]].draw_movable_vertex( this.UsedCtx[scene_indx], y - this.DraggedVertex_StartY );
        this.draw(scene_indx);
    }
    
    mouse_button_up(x, y, scene_indx) {
        if( this.DraggedVertex_SceneIndx == -1 ) return;

        // в случае если это вызвано на другом canvas-е - то не передвигаем вершину:  делаем delta_Y = 0
        if( scene_indx != this.DraggedVertex_SceneIndx ) {
            scene_indx  = this.DraggedVertex_SceneIndx;
            y           = this.DraggedVertex_StartY;
        }

        this.HistoryDraw[this.HistoryPoint[scene_indx]].finish_move_vertex( y - this.DraggedVertex_StartY );

        this.clear_ctx(scene_indx);
        this.draw     (scene_indx);

        // можно было бы и остальные переменые "занулить", но это лишние строчки, к тому же будет наверное даже слегка предусмотрительно #w#
        this.DraggedVertex_SceneIndx  = -1;
    }
};


let edge_example1 = [ [[1,2]], [[2,1], [3,1]], [[4,1]], [[5,1]], [], [[4,1]] ];

const ctx1 = my_widget_canvas      .getContext('2d');
const ctx2 = my_widget_debag_canvas.getContext('2d');



let myRadioHead = new GraphRecorder(ctx1, ctx2, edge_example1);
myRadioHead.draw(0);
myRadioHead.draw(1);


// === [ ПЕРЕТАСКИВАНИЕ ВЕРШИН ] (Аааа, боль, не будет ни какой "общности", тупо одни сtrl+c/v) =============
// MOUSE DOWN
my_widget_canvas      .addEventListener('mousedown', (event) => myRadioHead.mouse_button_down(event.offsetX, event.offsetY, 0) );
my_widget_debag_canvas.addEventListener('mousedown', (event) => myRadioHead.mouse_button_down(event.offsetX, event.offsetY, 1) );

// MOUSE MOVE
my_widget_canvas      .addEventListener('mousemove', (event) => myRadioHead.mouse_move_vertex(event.offsetX, event.offsetY, 0) );
my_widget_debag_canvas.addEventListener('mousemove', (event) => myRadioHead.mouse_move_vertex(event.offsetX, event.offsetY, 1) );

// MOUSE UP  (event.stopPropagation() - чтобы остановить всплытие события вверх по дереву DOM)
my_widget_canvas      .addEventListener('mouseup', (event) => { myRadioHead.mouse_button_up(event.offsetX, event.offsetY,  0); event.stopPropagation(); });
my_widget_debag_canvas.addEventListener('mouseup', (event) => { myRadioHead.mouse_button_up(event.offsetX, event.offsetY,  1); event.stopPropagation(); });
document              .addEventListener('mouseup', (event) => { myRadioHead.mouse_button_up(event.offsetX, event.offsetY, -1); });
// ==========================================================================================================

button_to_prev.addEventListener('click', () => {
    let pos = myRadioHead.HistoryPoint[1], L = myRadioHead.HistoryDraw.length;
    if( pos-1 > 0 ) {
        myRadioHead.HistoryPoint[1]--;
        myRadioHead.clear_ctx   (1)  ;
        myRadioHead.draw        (1)  ;
    }
});

button_to_next.addEventListener('click', () => {
    let pos = myRadioHead.HistoryPoint[1], L = myRadioHead.HistoryDraw.length;
    if( pos+1 < L-1 ) {    
        myRadioHead.HistoryPoint[1]++;
        myRadioHead.clear_ctx   (1)  ;
        myRadioHead.draw        (1)  ;
    }
});

// === [ НАЖАТИЕ НА ENTER ] =================================================================================
my_widget_input.addEventListener('keydown', (event) => {
    if( event.key != 'Enter' ) return;
    
    const terms = my_widget_input.value.trim().split(/\s+/);
    my_widget_input.value = '';

    if( terms[0] == 'to' ) {
        let path = terms.splice(1);
        if( !chk_path(path, myRadioHead.Edges) ) return;

        myRadioHead.clear_ctx(0);
        myRadioHead.draw(0, path);
    }

    if( terms[0] == 'br' ) {  // 'branch'
        let path = myRadioHead.HistoryDraw[myRadioHead.HistoryDraw.length-1].Vertex_path

        myRadioHead.cloning_last_scene();
        myRadioHead.branch_path(path);

        let L = myRadioHead.HistoryDraw.length;
        myRadioHead.HistoryDraw[L-1].recalc_graph_base (myRadioHead.Cnt_in, myRadioHead.Cnt_reveal);
        myRadioHead.HistoryDraw[L-1].change_vertex_path(path, 'orange');  // <- блин, там внутри и redraw_canvas() есть
        
        myRadioHead.clear_ctx(0);
        myRadioHead.draw(0);
        myRadioHead.clear_ctx(1);
        myRadioHead.draw(1);
    }
});

function chk_path(path, edges) {
    if( path.length == 0 ) return 1;

    // В начале должен быть корень (захардкожено: корень == 0)
    if( path[0] != 0 ) path.unshift(0);  // .unshift(a1, ..., an) - вставка в начало (изменяет исходный массив)

    // Проверка наличия ребёр
    for(let i = 0; i+1 < path.length; i++) {
        let v1 = path[i], v2 = path[i+1], exist_edge = 0;
        for(let [nxt] of edges[v1]) if( exist_edge = (nxt == v2) ) break;
        if( !exist_edge ) return 0;
    }
    return 1;
}
// ==========================================================================================================


})();

