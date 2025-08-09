
class StepMarker {
    #onConfirm: () => void;

    constructor(onConfirm: () => void) {
        this.#onConfirm = onConfirm;
    }

    confirm() {
        this.#onConfirm();
    }
}

export class StepChecker<E extends number> {
    #step: E;
    #stable = true;
    constructor(initialStep: E) {
        this.#step = initialStep;
    }

    checkStep(expectedStep: E, nextStep: E): StepMarker {
        if (!this.#stable) {
            throw new Error("Not in a stable state");
        }
        if (this.#step !== expectedStep) {
            throw new Error(`Expected step ${expectedStep}, but current step is ${this.#step}`);
        }
        this.#step = nextStep;
        this.#stable = false;
        return new StepMarker(() => {
            if (this.#stable) {
                throw new Error("StepMarker confirm called when already in a stable state");
            }
            this.#stable = true;
        });
    }

    getCurrentStep(): E {
        if (!this.#stable) {
            throw new Error("Not in a stable state");
        }
        return this.#step;
    }
};