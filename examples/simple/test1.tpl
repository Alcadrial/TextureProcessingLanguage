signal "Begin";

const mask = "mask.png";
signal;

var newIcon = {
    var f = "icon.png";
    signal "Start closure";
    ff() { signal "Executed ff"; };
    var g = {
        signal "Executing g";
        ff();
        return f;
    };
    signal;
    f *= f;
    signal "End closure";
    return g * f * g;
};

signal "End";
return newIcon ** mask;