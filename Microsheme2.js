
// сделать отдельный файл с рисованием компонент


let images_to_load = 1, images_already_load = 0;
function tryInit() {
    if( ++images_already_load == images_to_load ) Init();
}

function Init() {
    requestAnimationFrame(start_animation);
}         

function load_image(file_name) {
    let img = new Image();    
    img.src = file_name;
    
    images_to_load++;
    img.onload = tryInit;

    return img;
}



let IMG1 = load_image("animation.gif");


let      new_number_inner_variable = 0;
function new_number() { return new_number_inner_variable++; }


// !!! рисуем СЕТКУ с отсупом 0.5 так как на canvas есть тупое, не отключаемое "сглаживание"
let dS = 0.5;
// TODO: перечекать что на canvas соблюдается это смещение dS 

const TILE_RESOLUION = 50;


function del_somehow(arr, i) {
    let last_val = arr.pop();
    if( i == arr.length ) return 0;
    
    // произошёл "swap"
    arr[i] = last_val; 
    return 1;
}



class Microsheme {
    FieldInfo; FieldInfo1;
    FieldType;
    static TypeEmpty           = new_number();
    static TypeImage           = new_number();
    static TypeInnerMicrosheme = new_number();
    static TypeLink            = new_number();

    InnerMicroshemesIndx    = [];
    // TODO (или всё таки вообще не нужно?): InnerMicroshemesContour = []; 

    Xquantity = 0;
    Yquantity = 0;
    Xsize = 0;
    Ysize = 0;

    Scale = 1;

    Canvas;  // !!! рисуем СЕТКУ с отсупом 0.5 так как на canvas есть тупое, не отключаемое "сглаживание"
    Ctx   ;


    // РИСОВАНИЕ
    // ----------------------------------------------------------------------------------------------------------------
    static draw_grid(draw_ctx, x1, y1, x_quantity, y_quantity, a, line_width = 1) {
        let x2 = x1 + a*x_quantity, y2 = y1 + a*y_quantity

        for(let i = 0, indx = 0; i < y_quantity; i++)
        for(let j = 0; j < x_quantity; j++, indx++) {
            let x = x1 + a * j, y = y1 + a * i;
            draw_ctx.textAlign    = 'left';
            draw_ctx.textBaseline = 'top';
            // draw_ctx.fillText(String(indx), x, y);  // + ' ' + i + ' ' + j, x, y);  // ВЕРНУТЬ
        }

        draw_ctx.lineWidth   =  line_width;
        draw_ctx.strokeStyle = 'black';

        draw_ctx.beginPath();
        for(let j = 0; j <= x_quantity; j++) {
            draw_ctx.moveTo(x1 + j*a, y1);
            draw_ctx.lineTo(x1 + j*a, y2);
        }
        for(let i = 0; i <= y_quantity; i++) {
            draw_ctx.moveTo(x1, y1 + i*a);
            draw_ctx.lineTo(x2, y1 + i*a);
        }
        draw_ctx.stroke();
    }


    static recurse_draw_grid(draw_ctx, shift_x, shift_y, microsheme_array, id = 0, accumulated_scale = 1) {
        accumulated_scale *= microsheme_array[id].Scale;
        let A = TILE_RESOLUION / accumulated_scale;

        let line_width = (accumulated_scale <= 3) ? 1 : (accumulated_scale <= 8) ? 0.8 : 0.25;
        // let line_width = 1 / (accumulated_scale/2);
        Microsheme.draw_grid(draw_ctx, shift_x, shift_y, microsheme_array[id].Xquantity, microsheme_array[id].Yquantity, A, line_width);

        for(let indx of microsheme_array[id].InnerMicroshemesIndx) {
            let [i, j] = microsheme_array[id].indx_to_ij(indx);
            Microsheme.recurse_draw_grid(draw_ctx, shift_x + j*A, shift_y + i*A, microsheme_array, microsheme_array[id].FieldInfo[indx], accumulated_scale);
        }
    }

    // todo: переделать на x_size, y_size
    constructor(x_quantity, y_quantity, scale = 1) {
        this.Xquantity = x_quantity;
        this.Yquantity = y_quantity;
        this.Scale = scale;
        this.Xsize = Math.floor(x_quantity/scale);
        this.Ysize = Math.floor(y_quantity/scale);
        
        this.Canvas = new OffscreenCanvas(x_quantity*TILE_RESOLUION + 1, y_quantity*TILE_RESOLUION + 1);
        this.Ctx    = this.Canvas.getContext('2d');

        this.FieldType  = new Int32Array(x_quantity*y_quantity);
        this.FieldInfo  = new Int32Array(x_quantity*y_quantity);
        this.FieldInfo1 = new Int32Array(x_quantity*y_quantity);
    }

    ij_to_indx(i, j) { return i*this.Xquantity + j; }
    indx_to_ij(indx) { return [Math.floor(indx/this.Xquantity), indx%this.Xquantity]; }

    
    static HALO_OFFSET    = 0.2;  // на какую часть клетки выступает рамка микросхем

    // тут бы хранить path!
    static at(x, y, shift_x, shift_y, microsheme_array, id = 0, accumulated_scale = 1) {
        // Что если мы находимся на рамке микросхемы - будем переходить внутрь (тут захардкожен определённый вид рамки)
        
        // возвращает две ближащие грани (числа из {4, 0, 1, 2, 3}),  4 - значит что нет прикрепляемых блоков
        // limit_distance - должно быть меньше A
        function near_side(cell_dx1, cell_dy1, A, limit_distance) {
            let cell_dx2 = A - cell_dx1, cell_dy2 = A - cell_dy1;
            // (в этом комменте уже никакого смылса нет, но пусть будет как историческое "графити"): оххх, слово "restricted" - асоциируется только с restricted Hartry-Fock
            const distances = [[cell_dx2, 0], [cell_dy1, 1], [cell_dx1, 2], [cell_dy2, 3], [limit_distance, 4], [limit_distance, 4]]; // <- имбово с добавлением элемента [limit_distance, 4]
            // какой кринж, js не может нормально сортировать.....
            distances.sort( (a, b) => (a[0] - b[0]) || (a[1] - b[1]) );  // аналог сортировки pair из c++
            return [ distances[0][1], distances[1][1] ];
        }


        // [ИДЕЙНЫЙ ПРИКОЛ]: локально легко определять принадлежит ли точка рамке, но находить "сразу" весь контур было тошнотно.
        function get_indx_accounted_microsheme_halo(groundMicrosheme, i, j, x, y, A, indx0) {
            const is_microsheme_tile = (indx) => {  // требуется корректный indx
                let     field_type =  groundMicrosheme.FieldType[indx];
                return (field_type == Microsheme.TypeInnerMicrosheme) || (field_type == Microsheme.TypeLink)
            }

            if( indx0 != -1 && is_microsheme_tile(indx0) ) return indx0;

            // проверяем наличие рамок микросхем от соседей
            let [suggest1, suggest2] = near_side(x - j*A, y - i*A, A, Microsheme.HALO_OFFSET*A);
            let dxy = [ [+1, 0], [0, -1], [-1, 0], [0, +1], [0, 0] ];

            let updated_indx;  // <- !!! функция impact меняет эту переменную
            const impact = (ii, jj) => {
                if( !groundMicrosheme.is_in_indx(ii, jj) ) return 0;
                return is_microsheme_tile( updated_indx = groundMicrosheme.ij_to_indx(ii, jj) );
            }

            // АХАХАХ, лол конвеер: (потомушто impact "меняет внешнюю переменную")
            let    halo_impact   = (suggest1 != 4) &&  impact(i + dxy[suggest1][1], j + dxy[suggest1][0]);
                   halo_impact ||= (suggest2 != 4) && (impact(i + dxy[suggest2][1], j + dxy[suggest2][0]) ||  impact(i + dxy[suggest1][1] + dxy[suggest2][1], j + dxy[suggest1][0] + dxy[suggest2][0]));
            return halo_impact ? updated_indx : indx0;
        }


        let path = [];  // <- чебы не вынести её в одну глобальную переменную PATH
        while( 1 ) {
            let currGroundMicrosheme = microsheme_array[id];
            
            let inner_x = x - shift_x, inner_y = y - shift_y;

            let j = Math.floor( accumulated_scale*inner_x / TILE_RESOLUION );
            let i = Math.floor( accumulated_scale*inner_y / TILE_RESOLUION );
            

            // [МУСОР]: эхх, эпичный нейминг, но придется от него избавиться
            // let [halo_impact, halo_indx] = is_microsheme_halo(x, y);
            // let indx = halo_impact ? halo_indx : currGroundMicrosheme.ij_to_indx(i, j);


            // на первой итерации могут передаться такие (x,y) - что (i,j) будут не коректными!
            // И НЕ ТОЛЬКО НА ПЕРВОЙ!!! - ПОТОМ ТОЖЕ ТАКОЕ МОЖЕТ БЫТЬ (но там i,j максим на единицу за пределами поля)
            let indx0 = currGroundMicrosheme.is_in_indx(i, j) ? currGroundMicrosheme.ij_to_indx(i, j) : -1;

            // внимание: полученый здесь indx, может быть сдвинут от (i,j)
            let indx = get_indx_accounted_microsheme_halo(currGroundMicrosheme, i, j, inner_x, inner_y, TILE_RESOLUION/accumulated_scale, indx0);
            
            // Типо если (i,j) не корректные -> то indx0 = -1 -> если нет рамки на месте (x,y) то: indx = indx0 = -1
            // Если это произошло на первой      итерации  то:  возвращаем id = -1 мы не находимся в области root-микросхемы
            // Если это произошло на последующих итерациях то:  всё ок - мы находимся на рамке микросхемы -> возвращаем id
            if( indx == -1 ) return [shift_x, shift_y, accumulated_scale, id == 0 ? -1 : id, path];

            if( currGroundMicrosheme.FieldType[indx] == Microsheme.TypeLink            ) indx = currGroundMicrosheme.FieldInfo[indx];
            if( currGroundMicrosheme.FieldType[indx] != Microsheme.TypeInnerMicrosheme ) return [shift_x, shift_y, accumulated_scale, id, path];


            [i, j] = currGroundMicrosheme.indx_to_ij(indx);
            
            // переходим к вложенной микросхеме (i, j - указывают на положение вложеной микросхемы)
            path.push( [id, i, j, currGroundMicrosheme.FieldInfo[indx]] )
            id = currGroundMicrosheme.FieldInfo[indx];

            shift_x += j*TILE_RESOLUION / accumulated_scale;
            shift_y += i*TILE_RESOLUION / accumulated_scale;
            
            accumulated_scale *= microsheme_array[id].Scale;
        }
    }


    add_image(i, j) {
        let indx = this.ij_to_indx(i, j);
        this.FieldType[indx] = Microsheme.TypeImage;

        let x1 = dS + j*TILE_RESOLUION, y1 = dS + i*TILE_RESOLUION;
        this.Ctx.drawImage(IMG1, x1, y1, TILE_RESOLUION, TILE_RESOLUION);
    }



    is_in_indx(i1, j1, w = 1, h = 1) { return (0 <= j1 && j1+w <= this.Xquantity) && (0 <= i1 && i1+h <= this.Yquantity); }

    static crop(i, j, w, h, i1, i2, j1, j2) {
        let jj1 = Math.max(j1, j), jj2 = Math.min(j2, j + w);
        let ii1 = Math.max(i1, i), ii2 = Math.min(i2, i + h);
        return [ii1, ii2, jj1, jj2];
    }

    massive_array_set(arr, value, indx, x_size, y_size) {
        for(let di = 0; di < y_size; di++) {
            let pos = indx + this.Xquantity * di;
            for(let dj = 0; dj < x_size; dj++, pos++) {
                arr[pos] = value;
            }
        }
    }

    add_inner_microsheme(i, j, microsheme_array, id) {
        let indx = this.ij_to_indx(i, j);
        
        this.FieldInfo1[indx] = this.InnerMicroshemesIndx.length;
        this.InnerMicroshemesIndx.push(indx);

        let x_size = microsheme_array[id].Xsize, y_size = microsheme_array[id].Ysize;
        this.massive_array_set(this.FieldType, Microsheme.TypeLink, indx, x_size, y_size);
        this.massive_array_set(this.FieldInfo, indx               , indx, x_size, y_size);

        this.FieldType[indx] = Microsheme.TypeInnerMicrosheme;
        this.FieldInfo[indx] = id;

        // this.Ctx.clearRect(j*TILE_RESOLUION, i*TILE_RESOLUION, x_size*TILE_RESOLUION, y_size*TILE_RESOLUION);  // - для фана можно закоментить
        this.draw_inner_microsheme(i, j, microsheme_array, id);
        console.log('InnerMicroshemesIndx: ', this.InnerMicroshemesIndx);
    }

    delete_inner_microsheme(indx) {
        let id = this.FieldInfo[indx];
        let x_size = MicroshemeArray[id].Xsize, y_size = MicroshemeArray[id].Ysize;
        this.massive_array_set(this.FieldType, Microsheme.TypeEmpty, indx, x_size, y_size);
        
        let list_indx = this.FieldInfo1[indx];
        if( del_somehow(this.InnerMicroshemesIndx, list_indx) ) {  // при удалении последний элемент swap-нулся
            this.FieldInfo1[this.InnerMicroshemesIndx[list_indx]] = list_indx; 
        }


        // !!! TODO: апхваххпхвхахвхап - ЗАККОМЕНТИРОВАЛ ЭТО ПО ПРИКОЛУ
        let [i, j] = this.indx_to_ij(indx);
        // this.Ctx.clearRect(j*TILE_RESOLUION, i*TILE_RESOLUION, x_size*TILE_RESOLUION, y_size*TILE_RESOLUION);


        console.log('InnerMicroshemesIndx: ', this.InnerMicroshemesIndx);
    }

    // todo: при коректных данных тут по сути нужен только indx
    draw_inner_microsheme(i, j, microsheme_array, id) {
        let x1 = j*TILE_RESOLUION + dS, y1 = i*TILE_RESOLUION + dS;
        let x_size = microsheme_array[id].Xsize, y_size = microsheme_array[id].Ysize;
        this.Ctx.drawImage(microsheme_array[id].Canvas, x1, y1, x_size*TILE_RESOLUION, y_size*TILE_RESOLUION);

        // this.Ctx.fillStyle = 'rgba(256, 256, 0, 0.3)';
        // this.Ctx.fillRect(x1, y1, x_size*TILE_RESOLUION, y_size*TILE_RESOLUION);
    }



    // КОНТУРЫ МИКРОСХЕМ (на этом прям долг/проклятие висит - )
    // ----------------------------------------------------------------------------------------------------------------
    static create_corner_dots_array() {
        // [#] id угла вычисляется как: 16*A + 4*B + C
        //      B  |   C
        //    -----|-------
        //      A  | (угол)

        // [#] A, B, C - клетки, они могут быть:
        //    0 - пустая  клетка вне    микросхемы
        //    1 - занятая клетка вне    микросхемы
        //    2 - пустая  клетка внутри микросхемы
        //    3 - занятая клетка внутри микросхемы

        // [#] Положения точек (для построения границы) кодируются цифрами. Расположение цифр:
        //    |---------|---------|
        //    |         |         |
        //    |     3   4   5     |
        //    |         |         |
        //    |-----2---0---------|
        //    |         |
        //    |     1   |  (угол)
        //    |         |
        //    |---------|


        // Вручную добытые данные, прям физически из бумаги лол
        // ( где: inverted_arr[:][0] - список точек  для  построения границы )
        // (      inverted_arr[:][1] - список id углов имеющих такую границу )
        let inverted_arr = [
            [ [0],     [17, 49, 51, 21, 53, 55, 25, 57, 59, 29, 61, 63] ],
            [ [3],     [0, 32, 34, 8, 40, 42] ],
            [ [4],     [16, 48, 50, 54, 56, 58, 22] ],    
            [ [0,5],   [20, 52, 28, 60, 62, 30] ],
            [ [1,5],   [4, 12, 44, 46] ],
            [ [3,0],   [33] ],
            [ [2,0,5], [36] ],
            [ [2,0,4], [38] ],
            [ [0,2,3], [24, 26] ],
        ];

        // Для каждого варианта угла выделено четыре позиции. Не заполненые позиции заполняются -1.
        const arr = new Int8Array(64*4);
        

        // ----- (дальше без "читаемости") ----------------------------------------------------------------

        function compose(A, B, C) { return 16*A + 4*B + C;}
        function parse  (num)     { return [(num>>4)%4, (num>>2)%4, num%4]; }

        for(let i = 0; i < 64*4; i++) arr[i] = -1;

        function arr_set(id, dots) {
            for(let i = 0; i < dots.length; i++)
                arr[4*id + i] = dots[i];
        }

        function invert(dots) {
            let idots = [];
            for(let i = dots.length-1; i >= 0; i--) {
                // зеркальная точка
                idots.push( (6-dots[i])%6 );
            }
            return idots;
        }

        for(let [dots, ids] of inverted_arr) {
            let idots = invert(dots);
            for(let id of ids) {
                arr_set(id, dots);
                
                let [A, B, C] = parse(id);
                if( A == C ) continue;
                
                arr_set(compose(C, B, A), idots);
            }
        }
        return arr;
    }
    // в CLEAN версии, просто сразу написать значения массива corner_dots
    static corner_dots = Microsheme.create_corner_dots_array();

    static contour_colors = ['red', '#3cb44b', '#4363d8', '#f58231', '#911eb4'];
    // СТИЛЬНО ВЫГЛЯДИТ КОГДА: inner_offset = 0
    static draw_contour(x1, y1, a, sides, corners, draw_ctx, inner_offset, inner_scale, inner_canvas, clr='red', skip_drawing_contour = 0) {
        let H       = Microsheme.HALO_OFFSET*a;  // отступ
        let inner_H = inner_offset*H;

        let x_size = 0, y_size = 0;
        for(let d of sides[0]) x_size += d;
        for(let d of sides[1]) y_size += d;

        // ДАа, а какже как же DRY?... (типо в повороте холста наверное что-то подобное - наверное можно было и его использовать если бы строился только один контур) - ну ладно, лишь бы это сделать
        function side_rotation(which_side, A1, A2, B1, B2, a, b) {
            return [ [A1 + a, B1 - b], [A2 + b, B1 + a], [A2 - a, B2 + b], [A1 - b, B2 - a] ][which_side];
        }
        
        // border_shift - сдвиг по стороне, level_shift - сдвиг перепендикулярно стороне (паралельный/перпендикулярный сдвиги - там вроде специальное название для них есть по типу в "тройка векторов")
        let first_line_to = 1;
        function line_to(which_side, border_shift, level_shift) {
            let [x, y] = side_rotation(which_side, x1, x1 + x_size*a, y1, y1 + y_size*a, border_shift, level_shift);

            if( first_line_to ) draw_ctx.moveTo(x, y);
            else                draw_ctx.lineTo(x, y);
            first_line_to = 0;
        }

        function dpos(num) {
            let dx = 0, dy = 0;
            if( 1 <= num && num <= 3 ) dx = -1;
            if( num == 5 ) dx = +1;
            if( 3 <= num && num <= 5 ) dy = -1;
            if( num == 1 ) dy = +1;
            return [dx, -dy];  // перед dy "минус" - т.к. направление: "от стороны" - положительное
        }

        function process_side(which_side) {
            // точки на УГЛЕ
            let corner_id = corners[which_side];
            let prev_level;
            for(let i = 4*corner_id; Microsheme.corner_dots[i] != -1; i++) {
                let [dx, dy] =  dpos(Microsheme.corner_dots[i]);
                line_to(which_side, dx*H, dy*H);
                prev_level = dy;
            }

            // СТОРОНА
            for(let t = 0, dj = 0; t+1 < sides[which_side].length; t++, prev_level = !prev_level) {        
                dj += sides[which_side][t];
                if( prev_level ) {
                    line_to(which_side, dj*a-H, H);
                    line_to(which_side, dj*a  , 0);
                } else {
                    line_to(which_side, dj*a  , 0);
                    line_to(which_side, dj*a+H, H);
                }
            }
        }

        // -----------------------------
        // НЕ НАРАВ: рисуем микросхему (ВНЕЗАПНО!)
        draw_ctx.clearRect(x1, y1, a*x_size, a*y_size);
        // TODO: НУ КОНЕЧНО КОГДА КАРТИНКА СРАЗУ РИСЕУТСЯ НА ХОЛСТЕ ПОЛУЧАЕТСЯ КАЧЕСТВЕНЕЕ (а не при рисовании сначала на холсте микросхемы и потом при перерисовании на основной холст)
        
        // СРОЧНОЕ TODO [link1]: расскоментировать обратно эту строчку:  draw_ctx.drawImage(inner_canvas, x1, y1, a*x_size, a*y_size);  // <- TODO: сейчас по сути не нужны всякие microsheme.Canvas который аккумулирует в себе рисунки своих потомков :(
        Microsheme.draw_grid(draw_ctx, x1, y1, inner_scale*x_size, inner_scale*y_size, a/inner_scale, draw_ctx.lineWidth);

        if( skip_drawing_contour ) return;
        // -----------------------------


        // контур внешней границы
        draw_ctx.beginPath();
        process_side(0);
        process_side(1);
        process_side(2);
        process_side(3);
        draw_ctx.closePath();

        // контур внутреней границы
        draw_ctx.rect(x1+inner_H, y1+inner_H, a*x_size - 2*inner_H, a*y_size - 2*inner_H);

        
        draw_ctx.fillStyle = 'lightgray';
        draw_ctx.fill('evenodd');

        let w = draw_ctx.lineWidth; 
        draw_ctx.lineWidth   = 2*w;
        draw_ctx.strokeStyle = clr;
        draw_ctx.stroke();
        draw_ctx.lineWidth = w;
    }

    // кароче просто с НУЛЯ напишем
    calc_contour(indx) {
        let sides = [[], [], [], []], corners = [0, 0, 0, 0];
        
        let [i1, j1]      = this.indx_to_ij(indx);
        let microsheme_id = this.FieldInfo[indx];
        let x_size = MicroshemeArray[microsheme_id].Xsize, y_size = MicroshemeArray[microsheme_id].Ysize;

        // function impact(i, j, already_correct_indx = 0) {
        const impact = (i, j, already_correct_indx = 0) => {
            if( !already_correct_indx  &&  !this.is_in_indx(i, j) ) return 0;
            let field_type = this.FieldType[this.ij_to_indx(i, j)];
            return (field_type == Microsheme.TypeInnerMicrosheme) || (field_type == Microsheme.TypeLink);
        }

        // function recalc_side(i, j, dij, l) {
        const recalc_side = (i, j, dij, l) => {
            if( !this.is_in_indx(i, j) ) return [l];
            
            // todo: мб вообще отбрасывать последнее число (кода меньше будет по идее)
            let side = [], cnt = 0;
            for(let t = 0, lvl; t < l; t++, i += dij[0], j += dij[1]) {
                // ахах, сюда бы C++: let curr_lvl = excange(lvl, impact(i, j, 1)); и тогда бы не понадобилась строчка: lvl = curr_lvl;
                let curr_lvl  = impact(i, j, 1);
                if( t && lvl != curr_lvl ) {  // на первой итерации скипаем
                    side.push(cnt);
                    cnt = 0;
                }
                lvl = curr_lvl;
                cnt++;
            }
            side.push(cnt);

            return side;
        }
        // пофиг на хардкожено
        let dij = [ [0, +1], [+1, 0], [0, -1], [-1, 0] ];  // а хотя, давайте это вынесем

        // НЕ НРАВ: как будто можно было тоже draw_contour.side_rotation применить для индексов
        sides[0] = recalc_side(i1-1       , j1         ,  dij[0],  x_size);
        sides[1] = recalc_side(i1         , j1+x_size  ,  dij[1],  y_size);
        sides[2] = recalc_side(i1+y_size  , j1+x_size-1,  dij[2],  x_size);
        sides[3] = recalc_side(i1+y_size-1, j1-1       ,  dij[3],  y_size);

        function recalc_corner(i, j, dij1, dij2) {
            let C = 2 + impact(i, j);

            i += dij1[0]; j += dij1[1];
            let B = 2 + impact(i, j);
            
            i += dij2[0]; j += dij2[1];
            let A = 2 + impact(i, j);

            return 16*A + 4*B + C;
        }
        // пофиг на хардкожено
        corners[0] = recalc_corner(i1-1       , j1         ,  dij[2],  dij[1]);
        corners[1] = recalc_corner(i1         , j1+x_size  ,  dij[3],  dij[2]);
        corners[2] = recalc_corner(i1+y_size  , j1+x_size-1,  dij[0],  dij[3]);
        corners[3] = recalc_corner(i1+y_size-1, j1-1       ,  dij[1],  dij[0]);

        return [sides, corners];
    }

    // (i, start_pos) - подержка текущего смещения вдоль side. Для того чтобы при crop, проходили только "изменения", а не весь периметр
    static crop_contour_side(side, pos, len, i = 0, start_pos = 0) {  // ээхх, мечта - это прям leetcode функция и круто было бы если на неё были тесты
        let croped_side = [];

        while( start_pos + side[i] <= pos ) start_pos += side[i++];

        let pre_i = i - (start_pos == pos), start_i = i;
        let full_complete = 0;  // нужно только для post_i (закончилось ли len одновременно с каким-то сектором side)
        for(let  first_iter = 1; len; first_iter = 0) {
            if( !first_iter ) start_pos += side[i++];

            let side_len  = side[i] - (first_iter ? pos - start_pos : 0);
            full_complete = ( side_len == len );

            let sector = Math.min(side_len, len);
            croped_side.push( sector );
            len -= sector;
        }
        let post_i = i + full_complete;

        return [croped_side, pre_i, start_i, post_i, i, start_pos];
    }
    
    // ЭТО УЖЕ ПОЛУЧАЕТСЯ recurse_draw_MICROSHEME
    // МБ сделать эту функцию static?
    // accumulated_scale    - для толщины линий
    // skip_drawing_contour - чтобы у корневой микросхемы не рисовалась рамка
    recurse_draw_contour(x1, y1, a, parent_sides, parent_corners, draw_ctx, depth = -1, accumulated_scale = 1, skip_drawing_contour = 1) {
        // настройка толщины линий
        accumulated_scale *= this.Scale;
        let line_width = (accumulated_scale <= 4) ? 1 : (accumulated_scale <= 8) ? 0.8 : 0.25;
        draw_ctx.lineWidth = line_width;
        
        // по сути рисуем микросхему
        Microsheme.draw_contour(x1, y1, a, parent_sides, parent_corners, draw_ctx, 1/this.Scale, this.Scale, this.Canvas, Microsheme.contour_colors[depth%Microsheme.contour_colors.length], skip_drawing_contour);
        
        a /= this.Scale;


        // просто каждый раз пересчитываем calc_contour для всех внутренних микросхем . . .
        let InnerMicroshemesContour = [];
        for(let indx of this.InnerMicroshemesIndx) {
            InnerMicroshemesContour.push( this.calc_contour(indx) );
        }
    
        // 1. умножаем переданный от родителя контур на scale
        for(let which_side = 0; which_side < 4; which_side++)
            for(let i = 0; i < parent_sides[which_side].length; i++)
                parent_sides[which_side][i] *= this.Scale;

        // 2. просто проходимся вдоль границы и вызываем crop_contour_side для встреченных микросхем (todo: сделать чтобы был список граничных микросхем в порядке встречи)
        // (отмена/отказано) ай пофиг сделаем "префексную" сумму чтобы считать dl (=start_pos) (вернее на месте будем подсчитывать, т.к. "бегунки по parent_side" только увеличиватся)
        const process_side = (i, j, dij, size, which_side) => {
            let side = parent_sides[which_side];
            
            let t = 0, start_pos = 0;  // бегунки по parent_side

            for(let iter = 0, last_microsheme_id = 1; iter < size; iter++, i += dij[0], j += dij[1]) {
                let indx = this.ij_to_indx(i, j);
                if( this.FieldType[indx] == Microsheme.TypeLink ) indx = this.FieldInfo[indx];
                if( this.FieldType[indx] != Microsheme.TypeInnerMicrosheme ) continue;
                
                let  microsheme_id  =  this.FieldInfo[indx];
                if(  microsheme_id  == last_microsheme_id ) continue;
                last_microsheme_id   = microsheme_id;
                let  microsheme_size = which_side%2 ? MicroshemeArray[microsheme_id].Ysize : MicroshemeArray[microsheme_id].Xsize;

                // работаем
                
                // сторона
                let croped_side, pre_t, start_t, post_t;
                [croped_side, pre_t, start_t, post_t, t, start_pos] = Microsheme.crop_contour_side(side, iter, microsheme_size, t, start_pos);
                
                let pos_in_list = this.FieldInfo1[indx];
                InnerMicroshemesContour[pos_in_list][0][which_side] = croped_side;

                // углы
                // по id угла и (pre_i | start_i  ... i | post_i) - можно определять id углов для граничащих внутрених микросхем
                function cell_type(i, corner_id = parent_corners[which_side]) { return (corner_id%2)^(i%2); } // апхахпхах, как говорится: пох х пох (типо капец много функций хз наверное такое не "соптимизируется")
                function parse    (corner_id)    { return [(corner_id>>4)%4, (corner_id>>2)%4, corner_id%4]; }
                function compose  (A, B, C)      { return 16*A + 4*B + C;}
                
                let corners = InnerMicroshemesContour[pos_in_list][1];
                corners[ which_side     ] = compose(parse(corners[which_side])[0], cell_type(pre_t), cell_type(start_t));
                corners[(which_side+1)%4] = compose(cell_type(t), cell_type(post_t), parse(corners[(which_side+1)%4])[2]);
            }
        }
        let dij = [ [0, +1], [+1, 0], [0, -1], [-1, 0] ];  // а хотя, давайте это вынесем
        process_side(0               , 0               , dij[0], this.Xquantity, 0);
        process_side(0               , this.Xquantity-1, dij[1], this.Yquantity, 1);
        process_side(this.Yquantity-1, this.Xquantity-1, dij[2], this.Xquantity, 2);
        process_side(this.Yquantity-1, 0               , dij[3], this.Yquantity, 3);


        // 3. отдельно проходимся по угловым микросхемам и даём им id углов
        const call_corner = (i, j, which_side) => {
            let indx = this.ij_to_indx(i, j);
            if( this.FieldType[indx] == Microsheme.TypeLink ) indx = this.FieldInfo[indx];
            if( this.FieldType[indx] != Microsheme.TypeInnerMicrosheme ) return;
            
            let pos_in_list   = this.FieldInfo1[indx];
            InnerMicroshemesContour[pos_in_list][1][which_side] = parent_corners[which_side];
        }
        call_corner(0               , 0               , 0);
        call_corner(0               , this.Xquantity-1, 1);
        call_corner(this.Yquantity-1, this.Xquantity-1, 2);
        call_corner(this.Yquantity-1, 0               , 3);


        // вызываемся на потомках
        for(let iter = 0; iter < this.InnerMicroshemesIndx.length; iter++) {
            let indx =        this.InnerMicroshemesIndx   [iter];
            let [sides, corners] = InnerMicroshemesContour[iter];
            
            let [i, j] = this.indx_to_ij(indx);
            let id     = this.FieldInfo [indx];
            MicroshemeArray[id].recurse_draw_contour(x1 + j*a, y1 + i*a, a, sides, corners, draw_ctx, depth+1, accumulated_scale, 0);
        }
    }

};




let X0 = 30.5, Y0 = 30.5;
// let X0 = 30, Y0 = 30; // ВЕРНУТЬ


let MicroshemeArray = [new Microsheme(14, 9)];

function clear_canvas(cnvs) { cnvs.getContext('2d').clearRect(0, 0, cnvs.width, cnvs.height); }

// РЯЛ, рисуем границы микросхем на отдельном canvas!
let layer_for_contours = new OffscreenCanvas(layer1.width, layer1.height);
function draw_root_microsheme() {
    // !!!! БАЛИН, СЕЙЧАС БУДЕТ: "отпечатываем" рисунок каждой микросхемы реккурсивно -> А не, РЯЛ, рисуем границы микросхем на отдельном canvas!
    layer1.getContext('2d').drawImage(MicroshemeArray[0].Canvas, X0, Y0);
    // Microsheme.recurse_draw_grid   (layer1.getContext('2d'), X0, Y0, MicroshemeArray);

    // Microsheme.draw_grid(layer1.getContext('2d'), X0, Y0, MicroshemeArray[0].Xquantity, MicroshemeArray[0].Yquantity, TILE_RESOLUION);
    clear_canvas(layer_for_contours);
    MicroshemeArray[0].recurse_draw_contour(X0, Y0, TILE_RESOLUION, [[MicroshemeArray[0].Xsize], [MicroshemeArray[0].Ysize], [MicroshemeArray[0].Xsize], [MicroshemeArray[0].Ysize]], [42, 42, 42, 42] /* апхпх */, layer_for_contours.getContext('2d'));

    // для дебагинга:
    // layer1.getContext('2d').drawImage(layer_for_contours, 800, 0);
}




// тоже класс с ЕДИНСТВЕННЫМ представителем (чисто чтоб поменьше всего в глобале было)
class CursorPoint {
    Canvas  ;
    Ctx     ;
    Canvas_W;
    Canvas_H;
    

    // КООРДИНАТЫ МЫШИ
    IsOnCanvas = 0;  // обновляется "явно" от действий мышки (при выходе за canvas)
    IsOnField  = 0;  // курсор в пределах "корневой" микросхемы / обновляется "явно" от requestAnimationFrame и "неявно" от действий мышки 
    IsPossiblePlace = 0;
    X = -1;
    Y = -1;


    // ТЕКУЩИЙ ПРЕДМЕТ
    static TypeNewMicrosheme = new_number();

    // Сдвиг (отображаемого под курсором) объекта при единичном масштабе
    Obj_SHIFT_X = 0;
    Obj_SHIFT_Y = 0;
    Obj_CORNER_X = 0;
    Obj_CORNER_Y = 0;
    Obj_x_size = 1; Obj_y_size = 1; Obj_scale = 1;
    // CurrRotation = 0;

    CurrType = Microsheme.TypeEmpty;
    Scale    = 1;  // масштаб места где сейчас находится курсор


    // МИКРОСХЕМА на которую "смотрим"
    Microsheme_SHIFT_X = 0;
    Microsheme_SHIFT_Y = 0;
    PLACE_i = -1;
    PLACE_j = -1;
    CURR_id = 0;
    ROOT_Microsheme_SHIFT_X = 0;
    ROOT_Microsheme_SHIFT_Y = 0;

    
    HoveredInnerMicroshemesIndx = new Set();
    IsCntrlPressed = 0;
    IsSomethingCovered = 0;

    // ======================================================================================================

    // ПЕРЕРИСОВКА canvas

    // РУИНЫ когда-то планирующейся "эффективности":
    //       prevX; prevY; prevIsOnCanvas; prevCurrType; prevScale;
    //       record_curr_params() { ... }
    //       // later: сделать бы: return 1 - изменился предмет, return 2 - изменились координаты
    //       is_draw_change() {  // хехе, сюда бы макросы
    //           let visible       = (this.IsOnCanvas || this.prevIsOnCanvas) && ((this.CurrType != Microsheme.TypeEmpty) || (this.prevCurrType != Microsheme.TypeEmpty));
    //           let params_change = (this.IsOnCanvas != this.prevIsOnCanvas) || (this.X != this.prevX) || (this.Y != this.prevY) || (this.CurrType != this.prevCurrType) || (this.Scale != this.prevScale);
    //           this.record_curr_params();
    //           return visible && params_change;
    //       }

    recalc_and_redraw_all() {  // кароче функция делающая всё
        this.recalc_cursor_positioning();
        this.recalc_object_positioning();

        clear_canvas(this.Canvas);
        
        if( !this.IsOnCanvas ) {
            // СРОЧНОЕ todo [link1]: надо отдельно нормально вычислять layer_for_contours, а не с картинками микросхем на нём
            this.Ctx.drawImage(layer_for_contours, 0, 0);
            return;
        }

        this.highlight_covered_zone();


        // Если при "пустой" руке находимся на рамке - то выделяем микросхему имеющую эту рамку
        if( this.IsOnField && this.CURR_id && this.CurrType == Microsheme.TypeEmpty) {
            function is_in_rect(x, y, x1, y1, x2, y2) { return x1 <= x && x <= x2 && y1 <= y && y <= y2; }

            // находимся на рамке
            let A = TILE_RESOLUION / this.Scale, dA = Microsheme.HALO_OFFSET * A;
            let w = MicroshemeArray[this.CURR_id].Xquantity * A, h = MicroshemeArray[this.CURR_id].Yquantity * A;
            if( !is_in_rect(this.X - this.Microsheme_SHIFT_X, this.Y - this.Microsheme_SHIFT_Y, dA, dA, w - dA, h - dA) ) {
                this.Ctx.fillStyle = 'rgba(195, 220, 72, 0.4)';
                this.Ctx.fillRect(this.Microsheme_SHIFT_X, this.Microsheme_SHIFT_Y, w, h);
            }
        }


        // СРОЧНОЕ todo [link1]: надо отдельно нормально вычислять layer_for_contours, а не с картинками микросхем на нём
        this.Ctx.drawImage(layer_for_contours, 0, 0);

        // Рисуем объект под курсором
        let A = TILE_RESOLUION / (this.Scale * this.Obj_scale);
        if( this.CurrType  == Microsheme.TypeImage          ) {
            this.Ctx.drawImage(IMG1, this.Obj_CORNER_X, this.Obj_CORNER_Y, A, A);
        }
        if( this.CurrType  == CursorPoint.TypeNewMicrosheme ) {
            Microsheme.draw_grid(this.Ctx, this.Obj_CORNER_X, this.Obj_CORNER_Y, this.Obj_x_size*this.Obj_scale, this.Obj_y_size*this.Obj_scale, A);
        }
    }

   
    PATH = [];
    recalc_cursor_positioning() {
        // Вычисляем позицию микросхемы в которой находится курсор
        [this.Microsheme_SHIFT_X, this.Microsheme_SHIFT_Y, this.Scale, this.CURR_id, this.PATH] = Microsheme.at(this.X, this.Y, this.ROOT_Microsheme_SHIFT_X, this.ROOT_Microsheme_SHIFT_Y, MicroshemeArray);
    
        // ..... страшно ..... функция Microsheme.at() ..... это трюки какие-то ..... 
        this.IsOnField = (this.CURR_id != -1) && this.IsOnCanvas;
    }

    recalc_object_positioning() {  // кароче функция делающая всё
        // ВЫЧИСЛЯЕМ Параметры "объекта" рисуемого под курсором
        this.Obj_CORNER_X = this.X + this.Obj_SHIFT_X / this.Scale;
        this.Obj_CORNER_Y = this.Y + this.Obj_SHIFT_Y / this.Scale;

        // хак, типо сразу дали значения
        this.IsPossiblePlace             = 0;
        this.IsSomethingCovered          = 0;
        this.HoveredInnerMicroshemesIndx = new Set();

        if( !this.IsOnField ) return;

        let fld_x_quantity = MicroshemeArray[this.CURR_id].Xquantity, fld_y_quantity = MicroshemeArray[this.CURR_id].Yquantity;
        if( !( this.IsPossiblePlace = (this.Obj_x_size <= fld_x_quantity && this.Obj_y_size <= fld_y_quantity) ) ) return;


        // Магнитим область вставки объекта к сетке
        const magnetize_to_grid = (x, y) => {
            let A = TILE_RESOLUION / this.Scale;
            let i = Math.floor(y/A), j = Math.floor(x/A);
            if( (2*j+1)*A < 2*x ) j++;
            if( (2*i+1)*A < 2*y ) i++;
            return [i, j];
        }
        [this.PLACE_i, this.PLACE_j] = magnetize_to_grid(this.Obj_CORNER_X - this.Microsheme_SHIFT_X, this.Obj_CORNER_Y - this.Microsheme_SHIFT_Y);

        // Магнитим область вставки объекта внутрь поля
        this.PLACE_i = Math.min( Math.max(this.PLACE_i, 0),  fld_y_quantity - this.Obj_y_size );
        this.PLACE_j = Math.min( Math.max(this.PLACE_j, 0),  fld_x_quantity - this.Obj_x_size );

        // Проходимся по перекрываемам предметам на поле
        // Проходимся по перекрываемам предметам на поле
        for(let i = this.PLACE_i, di = 0; di < this.Obj_y_size; i++, di++)
        for(let j = this.PLACE_j, dj = 0; dj < this.Obj_x_size; j++, dj++) {
            let indx = MicroshemeArray[this.CURR_id].ij_to_indx(i, j);
            if( MicroshemeArray[this.CURR_id].FieldType[indx] == Microsheme.TypeLink  ) { indx = MicroshemeArray[this.CURR_id].FieldInfo[indx]; }

            if( MicroshemeArray[this.CURR_id].FieldType[indx] == Microsheme.TypeImage ) { this.IsSomethingCovered = 1; continue; }

            if( MicroshemeArray[this.CURR_id].FieldType[indx] == Microsheme.TypeInnerMicrosheme ) {
                this.IsSomethingCovered = 1;
                if( this.HoveredInnerMicroshemesIndx.has(indx) ) continue;
                // ну блин, мы конечно могли бы не использовать Set.has - но это ВОЗНЯ
                // хоть и могли бы железно получить линейную сложность: (Создать марицу-маску размера obj_x_size*obj_y_size показывающие какие (i, j) ещё не проверены. При встрече микросхемы отмечать все (i, j) лежащие в этой микросхеме.)

                // добавляем новую микросхему
                this.HoveredInnerMicroshemesIndx.add(indx);
                continue;
            }
        }
    }

    // подсветка зоны вставки
    highlight_covered_zone() {
        if( !this.IsOnField ) return;

        let A = TILE_RESOLUION / this.Scale;

        if( !this.IsPossiblePlace ) {  // Объект не способен вместиться на поле
            this.Ctx.fillStyle = 'rgba(256, 0, 0, 0.4)';
            this.Ctx.fillRect(this.Obj_CORNER_X, this.Obj_CORNER_Y, this.Obj_x_size*A, this.Obj_y_size*A)
            return;
        }

        this.Ctx.save();                                                       // сохраняем текущее состояние (включая трансформацию)
        this.Ctx.translate(this.Microsheme_SHIFT_X, this.Microsheme_SHIFT_Y);  // применяем сдвиг только внутри этой функции
        
        // Проходимся по перекрываемам предметам на поле
        this.Ctx.fillStyle = this.IsCntrlPressed ? 'rgba(0, 0, 0, 0.7)' : 'rgba(256, 0, 0, 0.4)';

        // Перекрываемые микросхемы
        this.Ctx.beginPath();
        for(let indx of this.HoveredInnerMicroshemesIndx) {
            let [i, j]   = MicroshemeArray[this.CURR_id].indx_to_ij(indx);
            let micro_id = MicroshemeArray[this.CURR_id].FieldInfo [indx];

            if( this.IsCntrlPressed ) {  // выделяем всю микросхему
                this.Ctx.fillRect(j*A, i*A, MicroshemeArray[micro_id].Xsize*A, MicroshemeArray[micro_id].Ysize*A);
                continue;
            }
            // выделяем перекрытую часть микросхемы
            let i1 = Math.max(i, this.PLACE_i), i2 = Math.min(i+MicroshemeArray[micro_id].Ysize, this.PLACE_i + this.Obj_y_size);
            let j1 = Math.max(j, this.PLACE_j), j2 = Math.min(j+MicroshemeArray[micro_id].Xsize, this.PLACE_j + this.Obj_x_size);
            this.Ctx.rect(j1*A, i1*A, (j2-j1)*A, (i2-i1)*A);
        }

        // Аккумулируем перекрытые Microsheme.TypeImage
        for(let i = this.PLACE_i, di = 0; di < this.Obj_y_size; i++, di++)
        for(let j = this.PLACE_j, dj = 0; dj < this.Obj_x_size; j++, dj++) {
            let indx = MicroshemeArray[this.CURR_id].ij_to_indx(i, j);
            if( MicroshemeArray[this.CURR_id].FieldType[indx] == Microsheme.TypeImage ) {
                this.Ctx.rect(j*A, i*A, A, A);
            }
        }
        this.Ctx.fill();

        
        // Область вставки объекта
        this.Ctx.fillStyle = 'rgba(0, 0, 256, 0.3)';
        this.Ctx.rect(this.PLACE_j*A, this.PLACE_i*A, this.Obj_x_size*A, this.Obj_y_size*A);
        
        this.Ctx.fill('evenodd');

        this.Ctx.restore();       // возвращаем прежнее состояние canvas
    }


    // ======================================================================================================

    // ADD EVENT LISTENER-ы (нормаально так вышло . . . , да даже ~почти имбово вышло!!!ы)
    mousemove(event) {
        this.IsOnCanvas = 1;
        this.X = event.offsetX;
        this.Y = event.offsetY;
    }

    mouseout(event) { this.IsOnCanvas = 0; }

    keydown(event) {
        const prev_code = [this.CurrType, this.Obj_x_size, this.Obj_y_size, this.Obj_scale];
        let   neww_code = structuredClone(prev_code);
        switch( event.key ) {
            case 'Control':
                // мда (дорогая операция)
                if( this.IsCntrlPressed != 1 ) {
                    this.IsCntrlPressed  = 1;
                    this.recalc_and_redraw_all();
                }
                return;

            case 'r':
                [neww_code[1], neww_code[2]] = [neww_code[2], neww_code[1]];
                break;

            case 'Escape': neww_code = [Microsheme .TypeEmpty        , 0, 0, 1]; break;
            case '1':      neww_code = [Microsheme .TypeImage        , 1, 1, 1]; break;
            case '2':      neww_code = [CursorPoint.TypeNewMicrosheme, 3, 2, 2]; break;
        }
        
        // есть ли изменение:  neww_code != prev_code
        if( neww_code.reduce( (acc, e, i) => (acc || e != prev_code[i]) , 0 ) ) {
            [this.CurrType, this.Obj_x_size, this.Obj_y_size, this.Obj_scale] = neww_code;
            this.Obj_SHIFT_X = -TILE_RESOLUION*this.Obj_x_size/2;
            this.Obj_SHIFT_Y = -TILE_RESOLUION*this.Obj_y_size/2;
            this.recalc_and_redraw_all();
        }
    }

    keyup(event) {
        switch( event.key ) {
            case 'Control':
                // мда
                if( this.IsCntrlPressed != 0 ) {
                    this.IsCntrlPressed  = 0;
                    this.recalc_and_redraw_all();
                }
                break;
        }
    };
    

    delete_covered_microshemes() {
        let cnt = 0;
        for(let indx of this.HoveredInnerMicroshemesIndx) {
            console.log('delete: ', ...MicroshemeArray[this.CURR_id].indx_to_ij(indx));
            MicroshemeArray[this.CURR_id].delete_inner_microsheme(indx);
            cnt++;
        }
        return cnt;
    }

    mousedown(event) {
        // хз, какой там порядок у обработчик событий, может этот вызов лишний, так как есть актуальный (с того момента мышка не сдвинулась) вызов highlight_covered_zone() красящий canvas
        this.recalc_cursor_positioning();
        this.recalc_object_positioning();
        
        if( !this.IsPossiblePlace) return;

        if( this.IsSomethingCovered && !this.IsCntrlPressed ) return;

        console.log('PLACE at: id=' + this.CURR_id + ' i=' + this.PLACE_i + ' j=' + this.PLACE_j);
        
        if( this.delete_covered_microshemes() ) {
            // на память что можно так сделать (см. возвращаемое значение delete_covered_microshemes)
            // типо вдруг тут полезно что-то написать
        }

        if( this.CurrType == Microsheme.TypeImage ) {
            MicroshemeArray[this.CURR_id].add_image(this.PLACE_i, this.PLACE_j);
            this.redraw_layer1();
            this.recalc_and_redraw_all();
            return;
        }

        if( this.CurrType == CursorPoint.TypeNewMicrosheme ) {
            MicroshemeArray.push( new Microsheme(this.Obj_x_size*this.Obj_scale, this.Obj_y_size*this.Obj_scale, this.Obj_scale) );

            MicroshemeArray[this.CURR_id].add_inner_microsheme(this.PLACE_i, this.PLACE_j, MicroshemeArray, MicroshemeArray.length-1);

            this.redraw_layer1();
            this.recalc_and_redraw_all();
            console.log('add: ', this.CURR_id, this.PLACE_i, this.PLACE_j, MicroshemeArray.length-1);
            console.log('create: ', MicroshemeArray.length-1, ' at: ', this.CURR_id);;
            return;
        }
    }

    redraw_layer1() {
        console.log('path: ', this.PATH);
        for(let t = this.PATH.length-1; t >= 0; t--) {
            let [id, i, j, inner_id] = this.PATH[t];
            console.log('upd: ', id, i, j, inner_id);
            MicroshemeArray[id].draw_inner_microsheme(i, j, MicroshemeArray, inner_id);
        }

        clear_canvas(layer1);
        draw_root_microsheme();
    }
    

    constructor(draw_canvas, root_microsheme_shift_x, root_microsheme_shift_y) {
        this.Canvas   = draw_canvas;
        this.Ctx      = draw_canvas.getContext('2d');
        this.Canvas_W = draw_canvas.width ;
        this.Canvas_H = draw_canvas.height;

        this.ROOT_Microsheme_SHIFT_X = root_microsheme_shift_x;
        this.ROOT_Microsheme_SHIFT_Y = root_microsheme_shift_y;
    }


};


let myCursorPoint = new CursorPoint(layer2, X0, Y0);


canvas_div.addEventListener('mousemove', (event) => myCursorPoint.mousemove(event) );
canvas_div.addEventListener('mouseout' , (event) => myCursorPoint.mouseout (event) );

document  .addEventListener('keydown'  , (event) => myCursorPoint.keydown  (event) );
document  .addEventListener('keyup'    , (event) => myCursorPoint.keyup    (event) );
document  .addEventListener('mousedown', (event) => myCursorPoint.mousedown(event) );



myCursorPoint.keydown( {key: '2'} );



// ===== [ КОНЕЦ "ЗАГРУЗКИ" ФАЙЛОВ ] =====
// когда все остальные подгрузки фото уже прошли (чтобы внезапно между прогрузками не завершилось tryInit)
tryInit();

let StartAnimationTime = 0;
function start_animation(time) {
    draw_root_microsheme();

    StartAnimationTime = time;
    requestAnimationFrame(animate);
}

let TimeDelay = 20;
function animate(time) {
    myCursorPoint.recalc_and_redraw_all();

    // let currFrameIndx = Math.floor( (time - StartAnimationTime)/TimeDelay );
    // if( currFrameIndx == FrameIndx ) { requestAnimationFrame(animate); return; }

    // ctx.clearRect(0, 0, AAAAA.width, AAAAA.height);
    
    // gif1.add_frames(currFrameIndx - FrameIndx);
    // ctx.drawImage(gif1.get_curr_frame(), 0, 0);
    
    // FrameIndx = currFrameIndx;
    // drawFrame(gif1, FrameIndx,  1,  0, 0, 0);
    // // drawFrame(gif2, FrameIndx,  0,  0, 0, 0);

    requestAnimationFrame(animate);
}

