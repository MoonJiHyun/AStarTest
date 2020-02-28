import {ATTR, IPos, IRect, STATE } from "./RectController";

const {ccclass, property} = cc._decorator;

@ccclass
export default class Rect extends cc.Component {
    @property(cc.Label)
    private fLabel: cc.Label = null;

    @property(cc.Label)
    private gLabel: cc.Label = null;

    @property(cc.Label)
    private hLabel: cc.Label = null;

    private rectInfo: IRect = null;
    private readonly rectColor = {
        closed: cc.Color.MAGENTA,
        end: cc.Color.BLUE,
        normal: cc.Color.WHITE,
        open: cc.Color.GREEN,
        result: cc.Color.YELLOW,
        start: cc.Color.RED,
        wall: cc.Color.BLACK,
    };

    public changeState(state: STATE) {
        switch (state) {
            case STATE.OPEN:
                this.node.color = this.rectColor.open;
                break;
            case STATE.CLOSED:
                this.node.color = this.rectColor.closed;
                break;
            case STATE.START:
                this.node.color = this.rectColor.start;
                break;
            case STATE.END:
                this.node.color = this.rectColor.end;
                break;
            case STATE.NORMAL:
                this.node.color = this.rectColor.normal;
                break;
            case STATE.RESULT:
                this.node.color = this.rectColor.result;
                break;
            case STATE.WALL:
                this.node.color = this.rectColor.wall;
                break;
        }
    }

    public setRectInfo(rectInfo) {
        this.rectInfo = rectInfo;
    }

    public setAttribute(attribute: ATTR) {
        this.rectInfo.attribute = attribute;
    }

    public setF(f: number) {
        this.rectInfo.f = f;
        const num = this.isInt(f) ? f : f.toFixed(1);

        this.fLabel.string = num.toString();
    }

    public setG(g: number) {
        this.rectInfo.g = g;
        const num = this.isInt(g) ? g : g.toFixed(1);

        this.gLabel.string = num.toString();
    }

    public setH(h: number) {
        this.rectInfo.h = h;
        const num = this.isInt(h) ? h : h.toFixed(1);

        this.hLabel.string = num.toString();
    }

    public setParent(parent: IRect) {
        this.rectInfo.parent = parent;
    }

    public setPos(pos: IPos) {
        this.rectInfo.pos = pos;
    }

    public setValue(value: number) {
        this.rectInfo.value = value;
    }

    public getRectInfo() {
        return this.rectInfo;
    }

    public getAttribute() {
        return this.rectInfo.attribute;
    }

    public getF() {
        return this.rectInfo.f;
    }

    public getG() {
        return this.rectInfo.g;
    }

    public getH() {
        return this.rectInfo.h;
    }

    public getParent() {
        return this.rectInfo.parent;
    }

    public getPos() {
        return this.rectInfo.pos;
    }

    public getValue() {
        return this.rectInfo.value;
    }

    protected onLoad() {
        this.node.on("touchstart", this.handleTouch);
    }

    protected unuse() {
        this.init(0, 0, 0);
    }

    private init(i: number, j: number, num: number) {
        this.rectInfo = {
            attribute: ATTR.NORMAL,
            f: 0,
            g: 0,
            h: 0,
            parent: null,
            pos: {
                col: j,
                row: i,
            },
            value: i + j * num,
        };
        this.node.color = this.rectColor.normal;
        this.fLabel.string = "";
        this.gLabel.string = "";
        this.hLabel.string = "";
    }

    private isInt(value) {
        return (parseFloat(value) === parseInt(value, 10)) && !isNaN(value);
    }

    private handleTouch = () => {
        cc.log("touched");
        cc.systemEvent.emit("TOUCHED", {
            pos: this.rectInfo.pos,
        });
    }
}
