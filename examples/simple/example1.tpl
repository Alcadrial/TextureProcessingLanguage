
const tileSet = "Dungeon Tile Set.png";

var wall = empty{192, 192};

var i = 1;
while (i < 11) {
    var j = 1;
    while (j < 11) {
        wall[i*16,j*16->(i+1)*16,(j+1)*16] = tileSet[10*16,5*16->11*16,6*16];
        j += 1;
    }
    i += 1;
}

i = 1;
while (i < 11) {
    var j = 1;
    wall[i*16,0->(i+1)*16,16] = tileSet[2*16,3*16->3*16,4*16];
    while (j < 11) {
        const ri = 1 + (random() % 13);
        const rj = 1 + (random() % 16);
        wall[i*16,j*16->(i+1)*16,(j+1)*16] = tileSet[ri*16,rj*16->(ri+1)*16,(rj+1)*16];
        j += 1;
    }
    wall[i*16,11*16->(i+1)*16,12*16] = tileSet[2*16,16->3*16,2*16];

    i += 1;
}
i = 0;
while (i < 2) {
    var j = 1;
    while (j < 11) {
        wall[11*i*16,j*16->(1+11*i)*16,(j+1)*16] = tileSet[(3-2*i)*16,2*16->(4-2*i)*16,3*16];
        j += 1;
    }
    i += 1;
}
wall[0*16,0*16->1*16,1*16] = tileSet[6*16,3*16->7*16,4*16];
wall[11*16,0*16->12*16,1*16] = tileSet[5*16,3*16->6*16,4*16];
wall[11*16,11*16->12*16,12*16] = tileSet[5*16,2*16->6*16,3*16];
wall[0*16,11*16->1*16,12*16] = tileSet[6*16,2*16->7*16,3*16];

return wall;