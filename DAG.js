// <!-- [РАССКОМЕНТИТЬ ДЛЯ demo] (! в самом конце файла тоже есть такая строчка) -->
// <!-- (+ сделать расширения файла: .html)                                      -->
// 
// <div> <input id="my_widget_input" type="text" value="to 0 1 3"> </div>
// <canvas      id="my_widget_canvas"       style="border: solid" width="800" height="300"></canvas>
// <canvas      id="my_widget_debag_canvas" style="border: solid" width="800" height="300"></canvas>
// 
// <div>
//     <button id="button_to_prev"> < </button>
//     <button id="button_to_next"> > </button>
// </div>
// 
// <script>
//


// потому что браузер ругается на: <script type="module" src="DAG.js">
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
// !!! Edges !!! Label_texts !!! CloningVertexInfo !!! - используются вне этого класса
class GraphDrawing {
    // (отмена): че бы не сделать ctrl+Z для Yc??? лул (kek - если эти же клавиши набирать с английской раскладкой)
    Xc           = [];
    Yc           = [];
    
    Label_width  = [];
    Label_texts  = [];  // Label_texts[i][0] - название вершины, Label_texts[i][1] - доп. инфо

    Edges        = [];
    IsVisited    = [];  // так как в массиве Edges могут быть "пустые вершины" (из-за удаления)
    
    // path храниться тут (а не в классе GraphRecorder), потому что у прошлых кадров мы можем менять положение вершин, а для этого надо знать какой путь выделять
    Vertex_path       = [];
    Vertex_path_color = 'purple';
    
    Canvas = new OffscreenCanvas(canvas_W, canvas_H);
    Ctx    = this.Canvas.getContext('2d');

    // [изменяется в GraphRecorder] [твик]  Для отслеживания "отщепления" вершин. (ещё один "контракт", которым придется прошивать все функициии, зато прикол)
    // Для каждой вершины $v$ хранится массив: ПЕРВЫЙ элемент в массиве это индекс "родительской" вершины $u$, ВТОРОЙ - позиция вершины $u$ в массиве родительской вершины $v$, ПОСЛЕДУЮЩИЕ - остальные отщепленые вершины. ТАК КРИВО, чтобы можно было удалять вершины.
    CloningVertexInfo = [];


    size() { return this.Edges.length; }
    
    constructor(edges, label_texts = null, cloning_vertex_info = null) {  // этот конструктор тоже "завладевает" данными
        if( label_texts == null ) {
            label_texts = [];
            for(let i = 0; i < edges.length; i++) label_texts.push( [generate_new_label(i), ""] );
        }
        if( cloning_vertex_info == null ) {
            cloning_vertex_info = [];
            for(let i = 0; i < edges.length; i++) cloning_vertex_info.push( [-1, -1] );
        }
        this.Edges             = edges              ;
        this.Label_texts       = label_texts        ;
        this.CloningVertexInfo = cloning_vertex_info;
    }

    light_cloning() {
        let cloned = new GraphDrawing( structuredClone(this.Edges), structuredClone(this.Label_texts), structuredClone(this.CloningVertexInfo) );
        cloned.setted_draw_CloningVertexInfo = structuredClone(this.setted_draw_CloningVertexInfo);
        return cloned;
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
    
    // static label_H_shift = -0.05*this.label_H;
    // * txts - массивы строк, пока ТОЛЬКО размера 1 или 2
    static draw_label(draw_ctx, xc, yc, txts, w = 0, notification = 0) {
        draw_ctx.textAlign    = "center";
        draw_ctx.textBaseline = "middle";
        draw_ctx.font         = '14px Arial';
        draw_ctx.fillStyle    = 'white';
        
        // а давайте захардкодим ПРЯМ ТАК :)))
        let is_vertex = ( txts.length == 2 );
        let h = is_vertex ? GraphDrawing.label_H : 15;
        
        let one_line = "";
        if( !is_vertex ) {
            for(let i = 0; i < txts.length; i++) one_line += (i ? "/" : "") + txts[i];
            w = GraphDrawing.get_label_width(draw_ctx, one_line, "");
        }
        
        draw_ctx.fillRect(xc - w/2, yc - h/2, w, h);

        // Текст
        draw_ctx.fillStyle = 'black';
        if( is_vertex ) { 
            draw_ctx.fillText( txts[0], xc, yc + GraphDrawing.label_H*0.05 - 7);
            draw_ctx.fillText( txts[1], xc, yc + GraphDrawing.label_H*0.05 + 7);
        } else {
            draw_ctx.fillText(one_line, xc, yc + 1);
        }

        // Нотификейшен (тип, что от этой вершины можно провести curr_GraphDrawing)
        if( notification ) {
            draw_ctx.fillStyle = 'cyan';
            draw_ctx.fillRect(xc + w/2 - 5, yc - h/2, 5, 5);
        }

        // Рамка
        draw_ctx.lineWidth    = 1;
        draw_ctx.strokeStyle  = 'black';
        draw_ctx.strokeRect(xc - w/2, yc - h/2, w, h);
    }

    // static highlight_edge(draw_ctx, x1, y1, x2, y2, path_color) { }

    static draw_edge(draw_ctx, x1, y1, x2, y2, cnt, clr = 'black') {
        if( cnt < 0 ) {
            cnt = -cnt;
            draw_ctx.setLineDash([7, 5]);        
        }
        draw_segment(draw_ctx, x1, y1, x2, y2, cnt, clr);
        draw_ctx.setLineDash([]);
        
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
        draw_ctx.fillStyle = clr;
        draw_ctx.fill();

        // циферка
        if( cnt != 1 ) GraphDrawing.draw_label(draw_ctx, x1 + dx/2, y1 + dy/2, [String(cnt)]);
    }


    static label_shift_postscript(txt, new_postscript) {
        // ай, пофиг что можно было без этого сделать, если бы в Label_texts использовали более "изысканый" массив
        let arr = txt.split('_');
        if( arr.length >= 3 ) arr.splice(1, 1); // оуу, не получилось в одну строчку. (уже не актуально, теперь это не круто): ШОК, я это полностью сам написал... (а не, загуглил поведение .splice() - If start >= array.length, no element will be deleted (but the method will behave as an adding function, adding as many elements as provided).)
        arr.push(new_postscript);
        return arr.join('_');
    }
// ==========================================================================================================


    // [TIER 1] Вычисление координат по топологии (блен, полезно оставлять комментыы)
    // предполагается ЕДИНСТВЕНЫЙ вызов этой функции когда закончили изменять граф - ай, ладно пускай будет одна функция которая тупо всё сразу делает
    recalc_graph_base(cnt_in) {  // ай, cnt_in конечно можно было бы внутри вычсилить, но ладно, будем передавать - так меньше строчек
        let  N         = this.size();
        let  cords_j   = new Int32Array(N);  // положение на уровне
        let  cords_h   = new Int32Array(N);  // глубина уровня
        this.IsVisited = new Int32Array(N);  // достигаемые вершины
        
        //  I. Раздаём BFS-ом глубины
        let height       =   0;
        let cnt_need_in  = [...cnt_in];
        for(let queue  = [0],  queue_pos = 0, new_layer_pos = 1; queue_pos < queue.length; ) {
            let vertex = queue[queue_pos];
            this.IsVisited[vertex] = 1;
            
            cords_h[vertex] = height;

            for(let [nxt] of this.Edges[vertex]) {
                if( --cnt_need_in[nxt] == 0 ) queue.push(nxt);
            }

            if( ++queue_pos == new_layer_pos ) {
                height++;
                new_layer_pos = queue.length;
            }
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
        for(let i = 0; i < N; i++) if( this.IsVisited[i] ) {
            let [j, h] = [cords_j[i], cords_h[i]];
            // (порядок слегка перевёрнутый - потому что рисуем "уровни" горизонтально)
            cords_j[i] = canvas_H* (j+1) / (cnt_on_layer [h]   +1);
            cords_h[i] = canvas_W* (h+1) / (cnt_on_layer.length+1);
        }
        this.Xc = cords_h;
        this.Yc = cords_j;


        //  IV. "Пересчёт" Label-ов
        this.Label_width = new Float32Array(N);
        for(let i = 0; i < N; i++) if( this.IsVisited[i] ) {
            this.Label_texts[i][1] = "[" + String(i) + "] " + String(cnt_in[i]);
            this.Label_width[i] = GraphDrawing.get_label_width(this.Ctx, ...this.Label_texts[i]);
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

    SkipedVertex = -1;
    // аргумент ф-ии:  * skiped_vertex == -2  -  используется this.SkipedVertex
    //                 * иначе переключаемся на вершину skiped_vertex (в частности если будет значение -1 - то никакая вершина не пропустится)
    redraw_canvas(skiped_vertex = -2) {
        console.log("!!! [redraw_canvas]");

        // Рил, пусть будет "переключалка" / "запоминалка"
        if( skiped_vertex == -2 )      skiped_vertex = this.SkipedVertex ;
        else                      this.SkipedVertex  =      skiped_vertex;  // ыхых, а можно и удалить разветвление (удалить только слово "else")

        this.Ctx.clearRect(0, 0, canvas_W, canvas_H);

        // Рёбра
        for(let i = 0; i < this.size(); i++) if( this.IsVisited[i] )  {
            if( i == skiped_vertex ) continue;
            for(let [j, cnt] of this.Edges[i]) {
                if( j == skiped_vertex ) continue;
                GraphDrawing.draw_edge(this.Ctx, this.Xc[i], this.Yc[i], this.Xc[j], this.Yc[j], cnt);
            }
        }

        // Выделям/подсвечиваем Vertex_path
        this.highlight_path(this.Ctx, this.Vertex_path, skiped_vertex);
        
        // Ребра из вершин выбранные в CloningVertexInfo
        // надо вызывать отдельно: this.draw_CloningVertexInfo(this.Ctx, this.setted_draw_CloningVertexInfo, skiped_vertex);
        
        // Названия вершин
        for(let i = 0; i < this.size(); i++) if( this.IsVisited[i] ) {
            if( i == skiped_vertex ) continue;
            GraphDrawing.draw_label(this.Ctx, this.Xc[i], this.Yc[i], this.Label_texts[i], this.Label_width[i], this.is_vertex_have_CloningVertexInfo(i));
        }
        
    }

    is_vertex_have_CloningVertexInfo(vertex_indx) { return this.CloningVertexInfo[vertex_indx][0] != -1 || this.CloningVertexInfo[vertex_indx].length > 2; }

    setted_draw_CloningVertexInfo = new Set();
       set_draw_CloningVertexInfo(vertex_indx) {        this.setted_draw_CloningVertexInfo.add   ( vertex_indx ); }
     unset_draw_CloningVertexInfo(vertex_indx) { return this.setted_draw_CloningVertexInfo.delete( vertex_indx ); }
    toggle_draw_CloningVertexInfo(vertex_indx) {
        if( vertex_indx < 0 || this.size() <= vertex_indx ) return 0;
        // 
        if( !this.is_vertex_have_CloningVertexInfo(vertex_indx) ) return 0;
        
        // [забавно]
        if( !this.unset_draw_CloningVertexInfo(vertex_indx) ) this.set_draw_CloningVertexInfo(vertex_indx);
        return 1;
    }

    draw_CloningVertexInfo(draw_ctx, setted_vertex, skiped_vertex) {
        for(let i of setted_vertex) {
            if( i == skiped_vertex ) continue;

            let adj = this.CloningVertexInfo[i];
            if( adj[0] != -1 && adj[0] != skiped_vertex ) {  // ребро к предку
                GraphDrawing.draw_edge(draw_ctx, this.Xc[i]+5, this.Yc[i]+5, this.Xc[adj[0]]+5, this.Yc[adj[0]]+5, -1, 'cyan');
            }

            for(let t = 2; t < adj.length; t++) {
                if( adj[t] == skiped_vertex ) continue;
                GraphDrawing.draw_edge(draw_ctx, this.Xc[i]-5, this.Yc[i]-5, this.Xc[adj[t]]-5, this.Yc[adj[t]]-5, -1, 'blue');
            }
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
    SkipedVertex_releating_path              = [];
    SkipedVertex_releating_CloningVertexInfo = [];
    SkipedVertex_is_setted_CloningVertexInfo =  0;
    start_move_vertex(vertex_indx) {
        this.redraw_canvas(vertex_indx);

        // Обычные рёбра, входящие в перетаскиваемую вершину
        this.InEdges = [];
        for(let i = 0; i < this.size(); i++) if( this.IsVisited[i] ) {
            for(let [j, cnt] of this.Edges[i]) {
                if( j == vertex_indx ) {
                    this.InEdges.push( [i, cnt] );
                    break;
                }
            }
        }

        // Ребра подсвеченного пути, инцидентные перетаскиваемой вершине
        this.SkipedVertex_releating_path = [];
        for(let p = 0; p < this.Vertex_path.length; p++) {
            if( this.Vertex_path[p] == vertex_indx ) {
                if( p-1 >= 0 )                      this.SkipedVertex_releating_path.push( this.Vertex_path[p-1] );
                                                    this.SkipedVertex_releating_path.push( this.Vertex_path[p  ] );
                if( p+1 < this.Vertex_path.length ) this.SkipedVertex_releating_path.push( this.Vertex_path[p+1] );
                break;
            }
        }

        // Ребра из CloningVertexInfo, которые входят в перетаскиваемую вершину
        this.SkipedVertex_is_setted_CloningVertexInfo = this.unset_draw_CloningVertexInfo(vertex_indx);
        this.SkipedVertex_releating_CloningVertexInfo = [];
        for(let i of this.setted_draw_CloningVertexInfo) {  // какой ужас, я это уже кодю на скорости прост, побыстрее бы завершить
            let adj = this.CloningVertexInfo[i];
            if( adj[0] == vertex_indx )     { this.SkipedVertex_releating_CloningVertexInfo.push( [i, 1] ); continue; }
            for(let t = 2; t < adj.length; t++) {
                if( adj[t] == vertex_indx ) { this.SkipedVertex_releating_CloningVertexInfo.push( [i, 0] ); break;    }
            }
        }


        console.log("SkipedVertex_releating_path: ", this.SkipedVertex_releating_path);
    }

    draw_movable_vertex(draw_ctx, dy) {
        let i = this.SkipedVertex, xc = this.Xc[i], yc = this.Yc[i] + dy;
        this.Yc[i] += dy;  // эххх, всётаки уродство вышло :(

        // Ребра
        for(let [j, cnt] of this.Edges[i]) GraphDrawing.draw_edge(draw_ctx,      xc   ,      yc   , this.Xc[j], this.Yc[j], cnt);
        for(let [j, cnt] of this.InEdges ) GraphDrawing.draw_edge(draw_ctx, this.Xc[j], this.Yc[j],      xc   ,      yc   , cnt);

        // Подсвечивание Vertex_path (той части, которая проходит через SkipedVertex)
        let L = this.SkipedVertex_releating_path.length;
        if( L ) this.highlight_path(draw_ctx, this.SkipedVertex_releating_path, -1, this.SkipedVertex_releating_path[L-1] == i);

        // Ребра из CloningVertexInfo
        if( this.SkipedVertex_is_setted_CloningVertexInfo ) this.draw_CloningVertexInfo(draw_ctx, [i], -1);
        for(let [j, to_parent] of this.SkipedVertex_releating_CloningVertexInfo) {  // ребра к перетаскиваемой вершине
            if( to_parent ) GraphDrawing.draw_edge(draw_ctx, this.Xc[j]+5, this.Yc[j]+5, this.Xc[i]+5, this.Yc[i]+5, -1, 'cyan');
            else            GraphDrawing.draw_edge(draw_ctx, this.Xc[j]-5, this.Yc[j]-5, this.Xc[i]-5, this.Yc[i]-5, -1, 'blue');
        }

        // Название Вершины
        GraphDrawing.draw_label(draw_ctx, xc, yc, this.Label_texts[i], this.Label_width[i], this.is_vertex_have_CloningVertexInfo(i));
        
        this.Yc[i] -= dy;  // эххх, всётаки уродство вышло :(
    }

    finish_move_vertex(total_dy) {
        this.Yc[this.SkipedVertex] += total_dy;

        if( this.SkipedVertex_is_setted_CloningVertexInfo ) this.set_draw_CloningVertexInfo(this.SkipedVertex);

        this.redraw_canvas(-1);  // там типо "переключалка": SkipedVertex = -1
    }

    
    // Если мы находимся в процессе перетаскивания вершины, то ф-ия which_vertex_covered должна возращать перетаскиваемую вершину. [прикольно вышло]
    which_vertex_covered(x, y) {
        if( this.SkipedVertex != -1 ) return this.SkipedVertex;

        for(let i = 0; i < this.size(); i++) if( this.IsVisited[i] ) {
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
    Cnt_in      = [  0 ];      // количество входящих рёбер от других вершин (без учёта кратности cnt) в вершину 

    
    // ССЫЛКА на МАССИВ (нет блин чтобы дать возможность ЯВНО указывать int&, нет надо именно знать что: "объекты всегда передаются и хранятся по ссылке.")
    Edges = [];
    


    size() { return this.Edges.length; }



    // ??? - проблема с пустым графом init_edges ???
    constructor(used_ctx0, used_ctx1, init_edges = []) {  // массив init_edges "забирается" (НУ БЛИН РЕАЛЬНО, БЫЛИ БЫ ТИПЫ)
        this.Edges  = init_edges;
        let  N      = init_edges.length;
        
        this.Cnt_in = new Array(N).fill(0);
        for(let i = 0; i < N; i++) {
            for(let [nxt] of this.Edges[i]) this.Cnt_in[nxt]++;
        }
        
        this.UsedCtx      = [used_ctx0, used_ctx1];
        this.HistoryPoint = [        1,         0];
        this.HistoryDraw  = [ new GraphDrawing([]), new GraphDrawing(init_edges) ];
        this.HistoryDraw[1].recalc_graph_base(this.Cnt_in);
        this.HistoryDraw[1].redraw_canvas();
    }

    print_info() {
        const FreeIndxes = new Set();
        for(let e of this.Free_vertex_indexes) FreeIndxes.add(e);

        let str = "";
        let edges = this.Edges;
        for(let i = 0; i < this.size(); i++) {
            if( FreeIndxes.has(i) || !edges[i].length ) continue;

            str += String(i) + " : ";
            let iter = 0;
            for(let [nxt, cnt] of edges[i]) {
                if( iter++ ) str += " , ";
                str += String(nxt);
                if( cnt > 1 ) str += "(" + String(cnt) + ")";
            }
            str += '\n';
        }
        console.log(str);
        
        console.log("Labels   :", this.last_scene().Label_texts);
        console.log("Labels  W:", this.last_scene().Label_width);
        console.log("IsVisited:", this.last_scene().IsVisited  );
        console.log("CntIn    :", this.Cnt_in);
        console.log("Free_vertex_indexes:", this.Free_vertex_indexes);
    }

    

    clear_ctx(scene_indx) { this.UsedCtx[scene_indx].clearRect(0, 0, canvas_W, canvas_H); }

    draw(scene_indx, path = null, path_color = null) {
        let curr_GraphDrawing = this.HistoryDraw[this.HistoryPoint[scene_indx]];

        // подсветка пути (!!! при смене пути вызываетя полный redraw_canvas) (Блен, это бы тоже как draw_CloningVertexInfo сделать. Но я сделал когда-то так, потому что хотел чтобы путь прям ЗАМОРАЖИВАЛСЯ в Canvas.)
        if( path != null ) curr_GraphDrawing.change_vertex_path(path, path_color);

        // подсветка CloningVertexInfo
        curr_GraphDrawing.draw_CloningVertexInfo(this.UsedCtx[scene_indx], curr_GraphDrawing.setted_draw_CloningVertexInfo, curr_GraphDrawing.SkipedVertex );

        this.UsedCtx[scene_indx].drawImage(curr_GraphDrawing.Canvas, 0, 0);
    }

    full_redraw() { for(let i = 0; i < this.UsedCtx.length; i++) { this.clear_ctx(i); this.draw(i); } }




    // клонирует последний "кадр" из HistoryDraw. Вернее только массивы Edges и Labels, ведь предполагается что другое будет пересчитываться. 
    cloning_last_scene() {
        this.HistoryDraw.push( this.last_scene().light_cloning() );
        
        // меняем ссылку
        this.Edges = this.last_scene().Edges;
        
        // ЫХХЫХЫХ, захардкожено
        let L = this.HistoryDraw.length;
        this.HistoryPoint[0] = L-1;
        this.HistoryPoint[1] = L-2;
    }
   
    // АХАХАХАХА, ГЕНИАЛЬНО, тут-то по ссылке возвращается значение
    last_scene() { return this.HistoryDraw[this.HistoryDraw.length-1]; }


// === [ РАБОТАЕМ ТОЛЬКО С ПОСЛЕДНИМ элементом HistoryDraw ] ================================================

    // индекс, который присвоится если мы создадим новую вершину
    get_indx_of_new_vertex() {
        let L = this.Free_vertex_indexes.length;
        return L ? this.Free_vertex_indexes[L-1] : this.size();
    }

    // создаётся вершина с:  cnt_in == 0
    // * parent_vertex - указывать при "отщеплении" вершины
    create_new_vertex(label, parent_vertex = -1) {
        // JS хаки))
        // .pop() - возвращает [removed element if array not empty] иначе [undefined]
        // a ?? b - эквивалентно: return (a === null || a === undefined) ? b : a
        let indx = this.Free_vertex_indexes.pop() ?? this.size();

        // arr.push( x ); и arr[arr.length] = x; дают одинаковый результат. Массив остается БЕЗ ПРОПУСКОВ. (((молимся на это)))
        this.             Cnt_in     [indx] =  0;
        this.             Edges      [indx] = [];
        this.last_scene().Label_texts[indx] = [label, ""];
        
        if( parent_vertex != -1 ) {  // "отщепление" вершины
            this.Edges[indx] = structuredClone(this.Edges[parent_vertex]);
            
            let adj = this.last_scene().CloningVertexInfo;
            adj[indx] = [parent_vertex, adj[parent_vertex].length];
            adj[parent_vertex].push(indx);
        } else {
            this.last_scene().CloningVertexInfo[indx] = [-1, -1];
        }

        return indx;
    }

    
    Free_vertex_indexes = [];
    // "помечание" вершины удалёной, cnt_in от этой вершины УМЕНЬШАЕТСЯ
    mark_deleted(vertex) {
        // редактируем CloningVertexInfo
        let adj = this.last_scene().CloningVertexInfo;
        for(let t = 2; t < adj[vertex].length; t++) {  // удаляем предка у потомков
            adj[adj[vertex][t]][0] = -1;  // пофиг, экономим строчки, не буду отдельно выделять child = adj[vertex][t], ещё и "мусор" в памяти остаётся (тип не обнуляем adj[child][1])
        }
        if( adj[vertex][0] != -1 ) {  // обновляем "родительскую" вершину
            let [parent_vertex, pos] = adj[vertex];
            let other_vertex  = adj[parent_vertex].pop();
            if( other_vertex != vertex ) {
                adj[ other_vertex][  1] = pos;
                adj[parent_vertex][pos] = other_vertex;
            }
        }
        // вообще тошнота (а вроде работает, чегооооо??)
        this.last_scene().unset_draw_CloningVertexInfo(vertex);


        this.Free_vertex_indexes.push(vertex);
        for(let [nxt] of this.Edges[vertex]) this.Cnt_in[nxt]--;
        this.Edges[vertex] = [];
    }

    // УЖАС, А СТРОКИ НЕ ВОЗВРАЩАЮТСЯ ПО ССЫЛКЕ, ПОДОБНО МАССИВам. А ТАК ХОТЕЛОСЬ: vertex_label(i) += "_add"
    get_vertex_label(i)   { return this.last_scene().Label_texts[i][0];       }
    set_vertex_label(i, txt)     { this.last_scene().Label_texts[i][0] = txt; }
    
    get_modified_label(i) { return GraphDrawing.label_shift_postscript(this.get_vertex_label(i), String(this.HistoryDraw.length)); }


    get_edge_indx(v1, v2) {
        for(let i = 0; i < this.Edges[v1].length; i++)
            if( this.Edges[v1][i][0] == v2 ) return i;
        return -1;
    }


// ==========================================================================================================


    // [TIER 1] Расслоение
    // блен, эту бы функцию выделить в отдельную (вне класса GraphRecorder), которая принимает только Edges, Cnt_in
    branch_path(path) {  // расслоение
        let branch_start = -1;  // такой индекс, что: cnt_ways_to[path[i]] > 1, а cnt_ways_to[path[i-1]] == 1
        for(let i = 1; i < path.length; i++) {  // i = 1  ~  у корня - точно cnt_ways == 1
            let vertex = path[i], prev_vertex = path[i-1];
            
            // Если  cnt_in == 1, то "ребро" ([nxt, cnt]) единственно ([ОШИБКА]: под индексом 0 - МОГУТ БЫТЬ ребра и к другим вершинам), и надо проеверить его кратность
            let edge_indx = this.get_edge_indx(prev_vertex, vertex);
            if( this.Cnt_in[vertex] > 1 || this.Edges[prev_vertex][edge_indx][1] > 1 ) { branch_start = i; break; }
        }
        
        console.log('[branch_path]: branch_start =', branch_start);
        // Все вершины на пути имеют cnt_ways_to == 1  ->  выходим (эти вершины ВООБЩЕ НЕ трогаем).    
        if( branch_start == -1 ) return;
   

        // Остальную часть пути меняем (отщепляем вершины):    !!! PATH РЕДАКТИРУЕТСЯ !!!
        for(let i = branch_start; i < path.length; i++) {
            let vertex = path[i], prev_vertex = path[i-1];  // !!! PATH РЕДАКТИРУЕТСЯ !!!

            // Создание новой вершины (отщепление от vertex) (клонирование)
            let new_vertex = this.create_new_vertex( this.get_modified_label(vertex), vertex );
            path[i]  = new_vertex;


            // Редактируем "предыдущее" ребро. Хотим чтобы оно указывало на new_vertex, а не на vertex. (prev_path_vertex -> new_vertex)
            let edge_indx = this.get_edge_indx(prev_vertex, vertex);
            if( edge_indx == -1 ) console.log("ERROR: должно быть ребро:  [" + String(prev_vertex) + "] -> [" + String(vertex) + "]");

            let cnt = this.Edges[prev_vertex][edge_indx][1];
            if( cnt == 1 ) {
                // перетираем ребро от (к обычному vertex) на (к new_vertex)
                this.Edges[prev_vertex][edge_indx][0] = new_vertex;
            } else {
                // уменьшаем кратность ребра (к обычному vertex)
                this.Edges[prev_vertex][edge_indx][1]--;
                
                // вставка ребра (к new_vertex) (todo: сейчас через splice, чтобы на картинке эти ребра поближе находились)
                this.Edges[prev_vertex].splice(edge_indx, 0, [new_vertex, 1]);  // splice(i, delete_cnt, insert_x1, insert_x2, ...) - начиная с индекса i: удаление delete_cnt элементетов, и вставка (на их место) insert_x1, insert_x2, ... 
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


    // [TIER 1] Копирование "вершины"
    paste_on_path_vertex(path, pasted_vertex) {
        // Уже есть ребро к pasted_vertex
        let last_vertex = path[path.length-1];
        let edge_indx   = this.get_edge_indx(last_vertex, pasted_vertex);
        console.log('last vertex: ', last_vertex);

        // Типо "теоретический" мув, лень расписывать, см. тетрадку. (нужно сделать это до branch_path, чтобы если вдруг pasted_vertex находится на path, то путь коректно отщепился)
        if( edge_indx == -1 ) this.Cnt_in[pasted_vertex]++;
        
        // Отщепляем путь и т. д.
        this.branch_path(path);

        let last_cloned_vertex = path[path.length-1];  // !!! path меняется !!!
        if( edge_indx != -1 ) this.Edges[last_cloned_vertex][edge_indx][1]++;
        else                  this.Edges[last_cloned_vertex].push( [pasted_vertex, 1] );
    }



    // [TIER 1] Удаление "вершины" 
    delete_last_vertex_on_path(path) {  // ЧЁТ мне эта функция больше всего не зашла (в плане эстетики??), хотя наверн уже просто взгляд замутненыййй...йй..йй.й.й.й
        let  deleted_vertex = path.pop();
        this.branch_path(path);

        // это кратное ребро - выходим
        let last_vertex = path[path.length-1];
        let edge_indx   = this.get_edge_indx(last_vertex, deleted_vertex);
        if( --this.Edges[last_vertex][edge_indx][1] ) return;

        // удаляем ребро
        let last_edge  = this.Edges[last_vertex].pop();
        if( edge_indx != this.Edges[last_vertex].length ) this.Edges[last_vertex][edge_indx] = last_edge;
        
        // вершина остаётся достигаемой
        if( --this.Cnt_in[deleted_vertex] ) return;
        
        // удаляем вершину ПОЛНОСТЬЮ
        this.delete_disjoint_vertex(deleted_vertex);
    }

    delete_disjoint_vertex(start_vertex) {
        let cnt_need_in = [...this.Cnt_in];
        // let cnt_need_in =    structuredClone(this.Cnt_in);
        
        // просто bfs..
        let queue = [start_vertex];
        for(let queue_pos = 0; queue_pos < queue.length; queue_pos++) {
            let vertex = queue[queue_pos];
            for(let [nxt] of this.Edges[vertex]) {
                if( --cnt_need_in[nxt] == 0 ) queue.push( nxt );
            }
            this.mark_deleted(vertex);
        }
    }

// ==========================================================================================================



// === [ ПЕРЕТАСКИВАНИЕ и ВЫБОР ВЕРШИН ] ============================================================================
    DraggedVertex_SceneIndx = -1;  // <- только по ней проверять доступность "блока":  DraggedVertex_... (сама DraggedVertex хранится в соответствующем GraphDrawing)
    DraggedVertex_StartY    = -1;
    mouse_button_down(button, x, y, scene_indx) {
        let curr_GraphDrawing = this.HistoryDraw[this.HistoryPoint[scene_indx]];
        let covered_vertex    = curr_GraphDrawing.which_vertex_covered(x, y);
        
        console.log("[history=" + String(this.HistoryPoint[scene_indx]) + " scene_indx=" + scene_indx + "] covered_vertex:", covered_vertex);
        

        // ЛКМ
        if( button == 2 ) {
            // захардкожена полная очистка выбраных вершин, при клике не по пустому полю
            let need_redraw = 0, setted = curr_GraphDrawing.setted_draw_CloningVertexInfo;  // ай, пофиг, что прям так в кишках копаемся
            if( covered_vertex != -1 ) need_redraw = curr_GraphDrawing.toggle_draw_CloningVertexInfo(covered_vertex);
            else if( setted.size )   { need_redraw = 1; setted.clear(); }

            console.log('pressed CloningVertexInfo, need_redraw:', need_redraw);
            if( need_redraw ) {
                this.clear_ctx(scene_indx);
                this.draw     (scene_indx);
            }
            return;
        }
        
        // любая другя КМ (предполагается что это ПКМ)
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
        this.draw     (scene_indx);
    }
    
    mouse_button_up  (x, y, scene_indx) {
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

// let edge_example1 = [ [[1,2], [3, 1]], [[2,1], [3,1]], [[4,1]], [[5,1]], [], [[4,1]] ];
// let edge_example1 = [ [ [1, 2], [2, 1] ], [ [2, 2] ], [ ] ];




const ctx1 = my_widget_canvas      .getContext('2d');
const ctx2 = my_widget_debag_canvas.getContext('2d');



let myRadioHead = new GraphRecorder(ctx1, ctx2, edge_example1);
myRadioHead.full_redraw();


// === [ ПЕРЕТАСКИВАНИЕ ВЕРШИН ] (Аааа, боль, не будет ни какой "общности", тупо одни сtrl+c/v) =============
// MOUSE DOWN
my_widget_canvas      .addEventListener('mousedown', (event) => myRadioHead.mouse_button_down(event.button, event.offsetX, event.offsetY, 0) );
my_widget_debag_canvas.addEventListener('mousedown', (event) => myRadioHead.mouse_button_down(event.button, event.offsetX, event.offsetY, 1) );

my_widget_canvas      .addEventListener('contextmenu', (event) => event.preventDefault() );
my_widget_debag_canvas.addEventListener('contextmenu', (event) => event.preventDefault() );


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


    if( terms[0] == 'info' ) {
        myRadioHead.print_info();
    }

    if( terms[0] == 'to' ) {
        let path = terms.splice(1).map(Number);
        if( !chk_path(path) ) return;
        console.log("to: ", path);

        myRadioHead.clear_ctx(0);
        myRadioHead.draw(0, path);
        return;
    }

    // Актуальный отображаемый путь
    let path = structuredClone(myRadioHead.last_scene().Vertex_path);
    
    if( terms[0] == 'br' ) {  // 'branch'
        myRadioHead.cloning_last_scene();
        myRadioHead.branch_path(path);

        myRadioHead.last_scene().recalc_graph_base (myRadioHead.Cnt_in);
        myRadioHead.last_scene().change_vertex_path(path, 'orange');  // <- блин, там внутри и redraw_canvas() есть
        
        myRadioHead.full_redraw();
    }

    if( terms[0] == 'ps' ) {  // 'paste'
        if( path.length == 0 ) path = [0];  // ай if-ы / костыли

        let pasted_vertex = Number(terms[1]);
        let is_creating_new_vertex = Number.isNaN(pasted_vertex);

        if( !is_creating_new_vertex && pasted_vertex == 0 ) return;  // нельзя вставлять корень (будет цикл). Также нельзя вставлять вершины которых нет, но такой проверки нет, ибо это прога только для дебагинга.

        if( is_creating_new_vertex ) {  // создаём новую вершину
            pasted_vertex = myRadioHead.get_indx_of_new_vertex();
        }

        console.log((is_creating_new_vertex ? "create" : "paste") + ":  [" + String(pasted_vertex) + "] into: ", path);

        myRadioHead.cloning_last_scene();

        if( !is_creating_new_vertex ) myRadioHead.paste_on_path_vertex(path, pasted_vertex);
        else {  // создаём новую вершину
            myRadioHead.create_new_vertex(generate_new_label(pasted_vertex));
            
            myRadioHead.Cnt_in[pasted_vertex] = 1;

            let last_vertex = path[path.length-1];
            myRadioHead.Edges[last_vertex].push( [pasted_vertex, 1] );
        }

        path.push( pasted_vertex );
        myRadioHead.last_scene().recalc_graph_base (myRadioHead.Cnt_in);
        myRadioHead.last_scene().change_vertex_path(path, 'purple');  // <- блин, там внутри и redraw_canvas() есть

        myRadioHead.full_redraw();
    }


    if( terms[0] == 'rm' ) {  // 'remove'
        if( path.length < 2 ) return;
        
        console.log("remove last vertex:  [" + String(path[path.length-1]) + "] into: ", path);

        myRadioHead.cloning_last_scene();
        myRadioHead.delete_last_vertex_on_path(path);

        myRadioHead.last_scene().recalc_graph_base (myRadioHead.Cnt_in);
        myRadioHead.last_scene().change_vertex_path(path, 'red');  // <- блин, там внутри и redraw_canvas() есть
    
        myRadioHead.full_redraw();
    }
});

function chk_path(path) {
    if( path.length == 0 ) return 1;

    // В начале должен быть корень (захардкожено: корень == 0)
    if( path[0] != 0 ) path.unshift(0);  // .unshift(a1, ..., an) - вставка в начало (изменяет исходный массив)

    // Проверка наличия рёбер
    for(let i = 0; i+1 < path.length; i++) {
        if( myRadioHead.get_edge_indx(path[i], path[i+1]) == -1 ) return 0;
    }
    return 1;
}
// ==========================================================================================================


})();

// <!-- [РАССКОМЕНТИТЬ ДЛЯ demo] -->
// </script>