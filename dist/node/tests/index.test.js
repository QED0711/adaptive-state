"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = __importStar(require("../index"));
const testManager = new index_1.default({
    isNull: null,
    isUndefined: undefined,
    nested: { isNull: null, isUndefined: undefined },
    user: {},
    myVal: 1,
    num1: 5,
    num2: 10,
    level1: {
        level2: {
            level3: 3
        },
        level2Val: "hello"
    },
    arr: [1, 2, 3]
}, {
    id: "TEST"
});
testManager.init();
testManager.addCustomGetters({
    getAddedNums: function () {
        return this.state.num1 + this.state.num2;
    }
});
testManager.addCustomSetters({
    setBothNums(num1, num2) {
        this.setState((prevState) => {
            return { num1, num2 };
        });
    }
});
testManager.addCustomMethods({
    deriveAdditionToNum1(num) {
        return this.getters.getNum1() + num;
    }
});
try {
    testManager.addNamespacedMethods({
        state: {
            test() { }
        }
    });
}
catch (err) {
    if (err.name === "ProtectedNamespaceError") {
        testManager.addNamespacedMethods({
            api: {
                getUser(userID) {
                    const user = { name: "test", id: 1 };
                    this.setters.setUser(user);
                }
            },
        });
    }
}
describe("Initialization:", () => {
    test("Init", () => {
        expect(testManager).toBeInstanceOf(index_1.default);
    });
    test("Valid StateSchema", () => {
        try {
            const a = { a: 1 };
            const b = a;
            a.b = b;
            new index_1.default(a, { id: "invalid" });
            expect(true).toBe(false);
        }
        catch (err) {
            expect(err.name).toBe("InvalidStateSchemaError");
        }
        try {
            const a = { a: function () { } };
            new index_1.default(a, { id: "invalid2" });
            expect(true).toBe(false);
        }
        catch (err) {
            expect(err.name).toBe("InvalidStateSchemaError");
        }
        try {
            const a = { a: 1 };
            new index_1.default(a, { id: "valid" });
            expect(true).toBe(true);
        }
        catch (err) {
            expect(err.name).toBe("InvalidStateSchemaError");
        }
    });
    test("getManagerByID", () => {
        expect(testManager).toBe(index_1.default.getManagerById("TEST"));
    });
    test("Instance ID", () => {
        expect(testManager.id).toBe("TEST");
    });
    test("Paths", () => {
        const paths = testManager.getPaths();
        // console.log(paths.myVal)
        expect(paths.myVal).toEqual(["myVal"]);
        expect(paths.level1).toEqual(["level1"]);
        // expect(paths.level1.level2).toEqual(["level1", "level2"]);
    });
});
describe("State Interactions", () => {
    describe("State Access", () => {
        test("State is accessible", () => {
            expect(testManager.state.myVal).toBeDefined();
        });
        test("State can access null/undefined", () => {
            expect(testManager.state.isNull).toEqual(null);
            expect(testManager.state.isUndefined).toEqual(undefined);
        });
        test("State is not directly mutable", () => {
            function shouldFail(path, update, action = "set") {
                let val = testManager.state;
                try {
                    for (let i = 0; i < path.length; i++) {
                        if (i === path.length - 1) {
                            switch (action) {
                                case "set":
                                    val[path[i]] = update;
                                    return 1;
                                case "delete":
                                    delete val[path[i]];
                                    return 1;
                            }
                        }
                        val = val[path[i]];
                    }
                    return 1;
                }
                catch (err) {
                    if (err.name === "ImmutableStateError") {
                        return 0;
                    }
                    else {
                        return 1;
                    }
                }
            }
            expect(shouldFail(["myVal"], 14)).toBe(0);
            expect(shouldFail(["myVal"], 14, "delete")).toBe(0);
            expect(shouldFail(["level1", "level2", "level3"], "TEST")).toBe(0);
            expect(shouldFail(["someNewVal"], "I'm New!!!")).toBe(0);
            expect(shouldFail(["arr", "0"], "This should work")).toBe(1); // only object properties are protected from mutation. Arrays within a schema are mutatable
        });
        describe("Disabled write protection", () => {
            const performanceManager = new index_1.default({ myVal: 1 }, { id: "performanceManager", enableWriteProtection: false });
            performanceManager.init();
            test("allows normal state operations", () => {
                performanceManager.setters.setMyVal(100);
                expect(performanceManager.getters.getMyVal()).toBe(100);
                performanceManager.setState({ myVal: 1 });
                expect(performanceManager.getters.getMyVal()).toBe(1);
            });
            test("allows unsafe mutation", () => {
                performanceManager.state.myVal = 2;
                expect(performanceManager.state.myVal).toBe(2);
            });
        });
    });
    describe("Getters", () => {
        test("Dynamic getters", () => {
            expect(testManager.getters.getMyVal()).toBe(1);
        });
        test("Custom getters", () => {
            expect(testManager.getters.getAddedNums()).toBe(15);
        });
        test("Nested Getters", () => {
            expect(testManager.getters.getLevel1()).toStrictEqual({ level2: { level3: 3 }, level2Val: "hello" });
            expect(testManager.getters.getLevel1_level2()).toStrictEqual({ level3: 3 });
            expect(testManager.getters.getLevel1_level2_level3()).toBe(3);
        });
        test("Getters return null/undefined", () => {
            const shouldBeNull = testManager.getters.getIsNull();
            const shouldBeUndefined = testManager.getters.getIsUndefined();
            expect(shouldBeNull).toEqual(null);
            expect(shouldBeUndefined).toEqual(undefined);
            expect(testManager.getters.getNested_isNull()).toEqual(null);
            expect(testManager.getters.getNested_isUndefined()).toEqual(undefined);
        });
        test("Getters return immutable state", () => {
            function shouldFail() {
                try {
                    const level1Obj = testManager.getters.getLevel1();
                    level1Obj.level2 = "This shouldn't be allowed";
                    return 0;
                }
                catch (err) {
                    if (err.name === "ImmutableStateError") {
                        return 1;
                    }
                    else {
                        return 0;
                    }
                }
            }
            expect(shouldFail()).toEqual(1);
        });
        test("getStateFromPath", () => {
            const val1 = testManager.getStateFromPath("myVal");
            const val2 = testManager.getStateFromPath(["level1", "level2", "level3"]);
            const stillNested = testManager.getStateFromPath(["level1", "level2"]);
            function shouldFail(val) {
                try {
                    val.test = "this should not work";
                    return 0;
                }
                catch (err) {
                    if (err.name === "ImmutableStateError") {
                        return 1;
                    }
                    else {
                        return 0;
                    }
                }
            }
            expect(val1).toEqual(1);
            expect(val2).toEqual(3);
            expect(stillNested.level3).toBe(3);
            expect(shouldFail(stillNested)).toBe(1);
        });
    });
    describe("Setters", () => {
        test("setState", () => {
            testManager.setState({ myVal: 2 });
            expect(testManager.getters.getMyVal()).toBe(2);
        });
        test("setState with functional argument", () => {
            testManager.setState(function (prevState) {
                const myVal = prevState.myVal;
                return { myVal: myVal + 1 };
            });
            expect(testManager.getters.getMyVal()).toBe(3);
        });
        test("Dynamic Setters", () => {
            testManager.setters.setMyVal(3);
            expect(testManager.getters.getMyVal()).toBe(3);
        });
        test("Custom Setters", () => {
            testManager.setters.setBothNums(50, 100);
            expect(testManager.getters.getAddedNums()).toBe(150);
        });
        test("Nested Setters", () => {
            testManager.setters.setLevel1_level2_level3(300);
            testManager.setters.setLevel1_level2Val("world");
            expect(testManager.getters.getLevel1_level2_level3()).toBe(300);
            expect(testManager.getters.getLevel1_level2Val()).toBe("world");
        });
        test("Setters Can Change null/undefined", () => {
            testManager.setters.setIsNull("not null");
            testManager.setters.setIsUndefined("not undefined");
            testManager.setters.setNested_isNull("not null");
            testManager.setters.setNested_isUndefined("not undefined");
            expect(testManager.state.isNull).toBe("not null");
            expect(testManager.state.isUndefined).toBe("not undefined");
            expect(testManager.state.nested.isNull).toBe("not null");
            expect(testManager.state.nested.isUndefined).toBe("not undefined");
            // return to null/undefined
            testManager.setters.setIsNull(null);
            testManager.setters.setIsUndefined(undefined);
            testManager.setters.setNested_isNull(null);
            testManager.setters.setNested_isUndefined(undefined);
            expect(testManager.state.isNull).toBe(null);
            expect(testManager.state.isUndefined).toBe(undefined);
            expect(testManager.state.nested.isNull).toBe(null);
            expect(testManager.state.nested.isUndefined).toBe(undefined);
        });
    });
    describe("Methods", () => {
        test("Custom Methods", () => {
            expect(testManager.methods.deriveAdditionToNum1(10)).toBe(60);
        });
        test("Namespaced Methods", () => {
            testManager.api.getUser(1);
            const user = testManager.getters.getUser();
            expect(user.name).toBe("test");
            expect(user.id).toBe(1);
        });
    });
});
describe("Events", () => {
    describe("Payload", () => {
        test("Standard Payload", () => __awaiter(void 0, void 0, void 0, function* () {
            const payload = yield new Promise(resolve => {
                testManager.addEventListener(["myVal"], (payload) => {
                    resolve(payload);
                });
                testManager.setters.setMyVal(42);
            });
            expect(payload.path).toEqual(["myVal"]);
            expect(payload.value).toBe(42);
        }));
        test("Nested Payload", () => __awaiter(void 0, void 0, void 0, function* () {
            const payload = yield new Promise(resolve => {
                testManager.addEventListener(["level1", "level2Val"], (payload) => {
                    resolve(payload);
                });
                testManager.setters.setLevel1_level2Val("Goodbye");
            });
            expect(payload.path).toEqual(["level1", "level2Val"]);
            expect(payload.value).toBe("Goodbye");
        }));
        test("null/undefined Values", () => __awaiter(void 0, void 0, void 0, function* () {
            testManager.setters.setIsNull("not null");
            testManager.setters.setIsUndefined("not undefined");
            testManager.setters.setNested_isNull("not null");
            testManager.setters.setNested_isUndefined("not undefined");
            // top level isNull
            let payload = yield new Promise(resolve => {
                testManager.addEventListener(["isNull"], (payload) => {
                    resolve(payload);
                });
                testManager.setters.setIsNull(null);
            });
            expect(payload.path).toEqual(["isNull"]);
            expect(payload.value).toEqual(null);
            // top level isUndefined
            const payload2 = yield new Promise(resolve => {
                testManager.addEventListener(["isUndefined"], (payload) => {
                    resolve(payload);
                });
                testManager.setters.setIsUndefined(undefined);
            });
            expect(payload2.path).toEqual(["isUndefined"]);
            expect(payload2.value).toEqual(undefined);
            // nested isNull
            const payload3 = yield new Promise(resolve => {
                testManager.addEventListener(["nested", "isNull"], (payload) => {
                    resolve(payload);
                });
                testManager.setState((prevState) => {
                    return { nested: Object.assign(Object.assign({}, prevState.nested), { isNull: null }) };
                });
            });
            expect(payload3.path).toEqual(["nested", "isNull"]);
            expect(payload3.value).toEqual(null);
            // nested level isUndefined
            const payload4 = yield new Promise(resolve => {
                testManager.addEventListener(["nested", "isUndefined"], (payload) => {
                    resolve(payload);
                });
                testManager.setters.setNested_isUndefined(undefined);
            });
            expect(payload4.path).toEqual(["nested", "isUndefined"]);
            expect(payload4.value).toEqual(undefined);
        }));
        test("Events Bubble", () => __awaiter(void 0, void 0, void 0, function* () {
            const payload = yield new Promise(resolve => {
                testManager.addEventListener("on_level1_update", (payload) => {
                    resolve(payload);
                });
                testManager.setters.setLevel1_level2Val("Hi there again!");
            });
            expect(payload.path).toEqual(["level1"]);
            expect(payload.value.level2Val).toBe("Hi there again!");
            expect(payload.value.level2.level3).toBeDefined();
        }));
        test("setState emits appropriate events", () => __awaiter(void 0, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f;
            const resolved = yield Promise.allSettled([
                new Promise(resolve => {
                    testManager.addEventListener("on_level1_update", (payload) => {
                        resolve(payload);
                    });
                }),
                new Promise(resolve => {
                    testManager.addEventListener("on_level1_level2_update", (payload) => {
                        resolve(payload);
                    });
                }),
                new Promise(resolve => {
                    testManager.addEventListener("on_level1_level2_level3_update", (payload) => {
                        resolve(payload);
                    });
                    testManager.setState({ level1: { level2Val: "UPDATED!!!", level2: { level3: -1 } } });
                }),
            ]);
            const results = resolved.map((prom) => {
                return prom.status === 'fulfilled' ? prom.value : null;
            });
            expect((_a = results[0]) === null || _a === void 0 ? void 0 : _a.path).toEqual(["level1"]);
            expect((_b = results[0]) === null || _b === void 0 ? void 0 : _b.value).toEqual({ level2: { level3: -1 }, level2Val: "UPDATED!!!" });
            expect((_c = results[1]) === null || _c === void 0 ? void 0 : _c.path).toEqual(["level1", "level2"]);
            expect((_d = results[1]) === null || _d === void 0 ? void 0 : _d.value).toEqual({ level3: -1 });
            expect((_e = results[2]) === null || _e === void 0 ? void 0 : _e.path).toEqual(["level1", "level2", "level3"]);
            expect((_f = results[2]) === null || _f === void 0 ? void 0 : _f.value).toEqual(-1);
        }));
        test("Full State Update", () => __awaiter(void 0, void 0, void 0, function* () {
            var _g;
            const payload = yield new Promise(resolve => {
                testManager.addEventListener("update", (payload) => {
                    resolve(payload);
                });
                testManager.setState({ myVal: 84 });
            });
            expect((_g = payload.state) === null || _g === void 0 ? void 0 : _g.myVal).toBe(84);
        }));
        test("removeEventListener", () => __awaiter(void 0, void 0, void 0, function* () {
            const value = yield new Promise((resolve) => __awaiter(void 0, void 0, void 0, function* () {
                const callback = (payload) => {
                    if (payload.value > 2)
                        resolve(payload.value); // if it makes it to the third call this will resolve to '3' and will fail the test
                };
                testManager.addEventListener("on_myVal_update", callback);
                yield testManager.setters.setMyVal(1);
                yield testManager.setters.setMyVal(2);
                testManager.removeEventListener(["myVal"], callback);
                yield testManager.setters.setMyVal(3);
                resolve(0);
            }));
            expect(value).toBe(0);
        }));
    });
});
describe("Local Storage Peristance", () => {
    test("Provider window name is set correctly", () => {
        const manager = new index_1.default({}, {
            id: "main",
        });
        manager.connectToLocalStorage({
            persistKey: "main",
            initializeFromLocalStorage: false,
            providerID: "windowTest",
        });
        manager.init();
        expect(index_1.WINDOW.name).toEqual("windowTest");
    });
    test("Persistance doesn't mutate local state", () => {
        index_1.default.clear();
        const manager = new index_1.default({
            a: {
                b: {
                    c: 3
                },
                d: 4
            },
            e: 5
        }, {
            id: "Persist",
        });
        manager.connectToLocalStorage({
            persistKey: "persist",
            initializeFromLocalStorage: false,
            providerID: "Persist",
            privateState: ["e", ["a", "b", "c"]]
        });
        manager.init();
        manager.setters.setA_d(10);
        expect(manager.state.a.b.c).toBe(3);
        expect(manager.state.e).toBe(5);
    });
    test("Initialize provider from local storage", () => {
        index_1.default.clear();
        index_1.WINDOW.name = "provider";
        index_1.WINDOW.localStorage.setItem("init", JSON.stringify({ a: 100 }));
        const manager = new index_1.default({ a: 1, b: 2 }, { id: "localStorageInit" });
        manager.connectToLocalStorage({
            persistKey: "init",
            initializeFromLocalStorage: true,
            providerID: "provider",
            privateState: ["b"]
        });
        manager.init();
        expect(manager.state.a).toEqual(100);
        expect(manager.state.b).toEqual(2);
    });
    test("Initialize subscriber from local storage", () => {
        index_1.default.clear();
        index_1.WINDOW.name = "someSubscriber";
        index_1.WINDOW.localStorage.setItem("init", JSON.stringify({ a: 100 }));
        const manager = new index_1.default({ a: 1, b: 2 }, { id: "localStorageInit" });
        manager.connectToLocalStorage({
            persistKey: "init",
            subscriberIDs: ["someSubscriber"],
            initializeFromLocalStorage: true,
            privateState: ["b"]
        });
        manager.init();
        expect(manager.state.a).toEqual(100);
        expect(manager.state.b).toBeUndefined();
    });
});
