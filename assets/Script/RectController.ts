import Rect from "./Rect";

const {ccclass, property} = cc._decorator;

export interface IRect {
    f: number;
    g: number;
    h: number;
    parent: IRect;
    pos: IPos;
    attribute: ATTR;
    value: number;
}

export interface IPos {
    row: number;
    col: number;
}

export const enum STATE {
    OPEN,
    CLOSED,
    NORMAL,
    START,
    END,
    RESULT,
    WALL,
}

export const enum ATTR {
    NORMAL,
    WALL,
}

@ccclass
export default class RectController extends cc.Component {
    @property(cc.Prefab)
    private rect: cc.Prefab = null;

    @property(cc.EditBox)
    private editBox: cc.EditBox = null;

    private row: number = 0;
    private col: number = 0;
    private endNodeCnt: number = -1;
    private wallNodeCnt: number = -1;
    private startNodeCnt: number = -1;
    private maxWalkableTileNum: number = 1;
    private isOptimizing: boolean = false;
    private rectArr: [Rect[]] = [[]];
    private endPoint: IPos = null;
    private startPoint: IPos = null;
    private rectPool: cc.NodePool = null;
    private findNeighbors: (myN, myS, myE, myW, N, S, E, W, neighbors) => void;
    private calculateDistance: (from: IPos, to: IPos) => number;

    protected onLoad() {
        this.rectPool = new cc.NodePool("rect");
        this.findNeighbors = this.DiagonalNeighbours;
        this.calculateDistance = this.DiagonalDistance;
        cc.systemEvent.on("TOUCHED", this.handleTouched);
    }

    private init() {
        for (const rect of this.rectArr) {
            for (let j = 0; j < this.col; j++) {
                this.rectPool.put(rect[j].node);
            }
        }
        this.endNodeCnt = -1;
        this.wallNodeCnt = -1;
        this.startNodeCnt = -1;
        this.rectArr = [[]];
        this.endPoint = null;
        this.startPoint = null;
    }

    // 빈 배열 만들기
    private initRect() {
        let rect;
        for (let i = 0; i < this.row; i++) {
            this.rectArr[i] = [];
            for (let j = 0; j < this.col; j++) {
                rect = (this.rectPool.size() > 0) ?
                    this.rectPool.get().getComponent(Rect) : cc.instantiate(this.rect).getComponent(Rect);
                rect.node.width = rect.node.height = 640 / this.row;
                rect.node.parent = this.node;
                rect.node.setPosition(rect.node.width * j, 640 - rect.node.height * (i + 1));
                rect.init(i, j, this.row);
                this.rectArr[i].push(rect);
            }
        }
    }

    private initGrid(num: number) {
        this.row = num;
        this.col = num;
    }

    private normalExample() {
        this.init();
        this.initGrid(10);
        this.initRect();
        this.setStartRect(2, 1);

        this.setWall(1, 3);
        this.setWall(2, 3);
        this.setWall(3, 3);

        this.setEndRect(2, 5);
    }

    private wikiExample() {
        this.init();
        this.initGrid(22);
        this.initRect();
        this.setStartRect(19, 2);

        for (let row = 6; row <= 13; row++) {
            if (row <= 8) {
                for (let col = 5; col <= 15; col++) {
                    this.setWall(row, col);
                }
            } else {
                for (let col = 13; col <= 15; col++) {
                    this.setWall(row, col);
                }
            }
        }

        this.setEndRect(3, 18);
    }

    private setStartRect(row: number, col: number) {
        this.startPoint = {row, col};
        this.rectArr[row][col].changeState(STATE.START);
    }

    private setEndRect(row: number, col: number) {
        this.endPoint = {row, col};
        this.rectArr[row][col].changeState(STATE.END);
    }

    private setWall(row: number, col: number) {
        this.rectArr[row][col].setAttribute(ATTR.WALL);
        this.rectArr[row][col].changeState(STATE.WALL);
    }

    private findPath() {
        let currRect;
        let currNeighbors;
        const result: Rect[]    = [];
        const openSet: Rect[]   = [];     // 열린 목록
        const closedSet: Rect[] = [];    // 닫힌 목록

        // 1. 열린 목록에 startRect를 넣습니다.
        this.pushArr(openSet, this.rectArr[this.startPoint.row][this.startPoint.col], STATE.OPEN);

        // while (openSet.length > 0) {
        this.schedule(() => {
            if (openSet.length === 0) {
                this.unscheduleAllCallbacks();
                cc.log("경로가 없습니다.");
                return [];
            }
            let minIndex = 0;

            // // 2. 열린 목록 중 F값이 가장 작은 rect를 찾습니다.
            for (let i = 0; i < openSet.length; i++) {
                if (this.isOptimizing) {
                    let alphaWeight = 0;
                    if (openSet[i].getG() <= openSet[i].getF()) {
                        alphaWeight = 1 - openSet[i].getG() / openSet[i].getF();
                    }
                    openSet[i].setF(openSet[i].getG() + openSet[i].getH() * (1 + 4 * alphaWeight));

                    if (openSet[i].getF() < openSet[minIndex].getF()) {
                        minIndex = i;
                    }
                } else {
                    if (openSet[i].getF() < openSet[minIndex].getF()) {
                        minIndex = i;
                    }
                }
            }

            // 2-1. 가장 f 값이 작은 rect를 현재 노드로 지정합니다.
            currRect = openSet.splice(minIndex, 1)[0];

            // 3. 현재 노드를 closedSet에 넣습니다.
            this.pushArr(closedSet, currRect, STATE.CLOSED);

            // 4. 목표 노드가 현재 노드와 일치하는 지 확인합니다.(종료 조건)
            if (currRect.getPos().col === this.endPoint.col && currRect.getPos().row === this.endPoint.row) {
                this.unscheduleAllCallbacks();

                let curr = currRect;
                do {
                    this.pushArr(result, curr, STATE.RESULT);
                    curr = curr.getParent();
                } while (curr);
                cc.log("최적 경로: ", result.reverse());
                return result.reverse();
            } else {
                let currNeighborPos;

                // 5. 현재 노드로부터 인접한 8개의 노드를 확인합니다.
                currNeighbors = this.Neighbors(currRect.getPos());

                for (currNeighborPos of currNeighbors) {
                    let isNeededReset = false;
                    const currNeighbor = this.rectArr[currNeighborPos.row][currNeighborPos.col];
                    const currNeighborG = currRect.getG() +
                        this.calculateDistance(currRect.getPos(), currNeighbor.getPos());

                    if (closedSet.indexOf(currNeighbor) > -1 ||
                            !this.canWalkHere(currNeighborPos.row, currNeighborPos.col)) {
                        continue;
                    }

                    if (openSet.indexOf(currNeighbor) < 0) {
                        isNeededReset = true;

                        currNeighbor.setH(this.calculateDistance(currNeighbor.getPos(), this.endPoint));
                        this.pushArr(openSet, currNeighbor, STATE.OPEN);
                    } else if (currNeighborG < currNeighbor.getG()) {
                        isNeededReset = true;
                    }

                    if (isNeededReset) {
                        currNeighbor.setParent(currRect);
                        currNeighbor.setG(currNeighborG);
                        currNeighbor.setF(currNeighbor.getG() + currNeighbor.getH());
                    }
                }
            }
        }, 0.1);
    }

    private pushArr(arr, element, state) {
        arr.push(element);
        element.changeState(state);
    }

    private DiagonalDistance(from: IPos, to: IPos) {
        return Math.max(Math.abs(from.row - to.row), Math.abs(from.col - to.col));
    }

    private EuclideanDistance(from: IPos, to: IPos) {
        return Math.sqrt(Math.pow(from.row - to.row, 2) + Math.pow(from.col - to.col, 2));
    }

    private Neighbors(pos: IPos) {
        const neighbors: IPos[] = [];
        const col = pos.col;
        const row = pos.row;
        const N = col - 1;
        const S = col + 1;
        const W = row - 1;
        const E = row + 1;
        const myN = N > -1 && this.canWalkHere(row, N);
        const myS = S < this.col && this.canWalkHere(row, S);
        const myE = E < this.row && this.canWalkHere(E, col);
        const myW = W > -1 && this.canWalkHere(W, col);

        if (myN) {
            neighbors.push({row, col : N});
        }
        if (myS) {
            neighbors.push({row, col : S});
        }
        if (myE) {
            neighbors.push({row : E, col});
        }
        if (myW) {
            neighbors.push({row : W, col});
        }

        this.findNeighbors(myN, myS, myE, myW, N, S, E, W, neighbors);

        return neighbors;
    }

    private DiagonalNeighbours(myN, myS, myE, myW, N, S, E, W, neighbors) {
        if (myN) {
            if (myE && this.canWalkHere(E, N)) {
                neighbors.push({row: E, col: N});
            }
            if (myW && this.canWalkHere(W, N)) {
                neighbors.push({row: W, col: N});
            }
        }
        if (myS) {
            if (myE && this.canWalkHere(E, S)) {
                neighbors.push({row: E, col: S});
            }
            if (myW && this.canWalkHere(W, S)) {
                neighbors.push({row: W, col: S});
            }
        }
    }

    private canWalkHere(row, col) {
        return (this.rectArr[row] && this.rectArr[row][col] &&
        (this.rectArr[row][col].getAttribute() < this.maxWalkableTileNum));
    }

    private handleTouched = (event) => {
        const pos = event.pos;

        if (this.startNodeCnt === 0) {
            this.setStartRect(pos.row, pos.col);
            this.startNodeCnt++;
        } else if (this.endNodeCnt === 0) {
            this.setEndRect(pos.row, pos.col);
            this.endNodeCnt++;
        } else if (this.wallNodeCnt >= 0) {
            this.setWall(pos.row, pos.col);
            this.wallNodeCnt++;
        }
    }

    private onClickFindBtn() {
        const result = this.findPath();
    }

    private onClickWikiBtn() {
        this.wikiExample();
    }

    private onClickNormalBtn() {
        this.normalExample();
    }

    private onClickStartNodeBtn() {
        if (this.startNodeCnt >= 1) {
            return;
        }

        this.startNodeCnt = 0;
    }

    private onClickEndNodeBtn() {
        if (this.endNodeCnt >= 1) {
            return;
        }
        this.endNodeCnt = 0;
    }

    private onClickWallBtn() {
        this.wallNodeCnt = 0;
    }

    private onClickClearBtn() {
        this.init();
        this.initGrid(this.row);
        this.initRect();
    }

    private onClickInputSizeBtn() {
        this.init();
        this.row = this.col = parseInt(this.editBox.string, 10);
        this.initGrid(this.row);
        this.initRect();
    }

    private onCheckOptimizing(event) {
        this.isOptimizing = event.isChecked;
    }

    private onCheckEuclidean(event) {
        this.calculateDistance = (event.isChecked) ? this.EuclideanDistance : this.DiagonalDistance;
    }
}
