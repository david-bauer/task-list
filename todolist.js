// global constants
const COOKIE_NAME = 'tasks';
const ANIMATION_TIMING = parseInt(getComputedStyle(document.body).getPropertyValue('--animation-timing').slice(0, -2));


function randomizePlaceholder(input) {
    // set a randomized placeholder message for this input field
    const placeholders = [
        'buy bananas...', 'go for a run...', 'add a task...', 'to do...', 'hug bessie...',
        'do laundry...', 'moo...', 'move to a farm...', 'elope...', 'build an app...',
        'make lunch...', 'call mom...'];
    input.placeholder = placeholders[Math.round(Math.random() * (placeholders.length - 1))];
}


function slideElem(elem, start, end) {
    // moves an element up 'start' pixels and then slides it to 'end'
    const keyframes = [
        {transform: `translate(${0}px, ${start}px)`},
        {transform: `translate(${0}px, ${end}px)`}];

    return elem.animate(keyframes, ANIMATION_TIMING)
}


class Task {
    constructor(text, completed = false, index = 0) {
        /*  example list item
        <li class="task" aria-checked="false" data-index="index">
            <span class="task-name">Example</span>
            <button class="drag-btn" aria-pressed="false"><i class="fa-solid fa-arrows-up-down"></i></button>
            <button class="delete-btn" aria-pressed="false"><i class="fa-solid fa-trash-can"></i></button>
        </li> */

        this._text = text;
        this._completed = completed;
        this._index = index;

        this.elem = document.createElement('li');
        this.elem.setAttribute('aria-checked', this.completed.toString());
        this.elem.classList.add('task');
        this.elem.dataset.index = index.toString();

        this.nameElem = document.createElement('span');
        this.nameElem.classList.add('task-name');
        this.nameElem.innerText = text;

        this.elem.innerHTML =
            '<button class="drag-btn" aria-pressed="false"><i class="fa-solid fa-arrows-up-down"></i></button>' +
            '<button class="delete-btn" aria-pressed="false"><i class="fa-solid fa-trash-can"></i></button>';
        this.elem.prepend(this.nameElem);
    }

    /* getters and setters */

    get name() {
        return this._text;
    }

    set name(newName) {
        this._text = newName;
        this.nameElem.innerText = newName;
    }

    get completed() {
        return this._completed;
    }

    set completed(newState) {
        if (typeof newState !== "boolean") {
            throw TypeError(`Task.completed must be set to a boolean, not a ${typeof newState}`)
        }
        this._completed = newState;
        this.elem.setAttribute('aria-checked', newState.toString());
    }

    set index(newIndex) {
        if (newIndex === this.index) return;
        this._index = newIndex;
        this.elem.dataset.index = newIndex.toString();
    }

    get index() {
        return this._index;
    }

    /* helper methods */

    grow() {
        const keyframes = [
            {transform: "scaleY(0)"},
            {transform: "scaleY(1)"}];
        return this.elem.animate(keyframes, ANIMATION_TIMING);
    }

    shrink() {
        const keyframes = [
            {transform: "scaleY(1)"},
            {transform: "scaleY(0)"}];
        return this.elem.animate(keyframes, ANIMATION_TIMING);
    }

    toJSON() {
        // minify tasks by saving only the name and state when JSON.stringify is called on this object
        return {name: this.name, completed: this.completed};
    }
}

class TaskList extends Array {
    constructor() {
        super();
        this.elem = document.createElement('ul');
        this.elem.classList.add('task-list');
    }

    #validateIndex(input) {
        if (typeof input === "number") {
            if (input in this) {
                return input;
            } else {
                throw RangeError('Index out of range');
            }
        } else {
            throw TypeError(`Expected an index. Instead received ${typeof input}`)
        }
    }

    push(...newTasks) {
        if (newTasks.some(newTask => !newTask instanceof Task)) {
            throw TypeError("Cannot add a non-Task object to a TaskList");
        }
        newTasks.forEach(newTask => {
            this.elem.append(newTask.elem);
            newTask.grow();
            newTask.index = this.length;
            super.push(newTask);
        });
        return this.length;
    }

    pop() {
        if (this.length === 0) {
            return undefined;
        }
        const removedTask = super.pop();
        removedTask.shrink().finished.then( () => {
            this.elem.removeChild(removedTask.elem);
        });
        return removedTask;
    }

    create(text, completed = false) {
        this.push(new Task(text, completed, this.length));
    }

    swap(taskRefOne, taskRefTwo) {
        const indexA = Math.min(this.#validateIndex(taskRefOne), this.#validateIndex(taskRefTwo));
        const taskA = this[indexA];
        const indexB = Math.max(taskRefOne, taskRefTwo);
        const taskB = this[indexB];

        if (indexA === indexB) return;

        const oldPosA = taskA.elem.offsetTop;
        const oldPosB = taskB.elem.offsetTop;

        // update the DOM
        taskA.index = indexB;
        taskB.index = indexA;

        if (this.length === 2) {
            taskB.elem.after(taskA.elem);
        }

        const prevA = taskA.elem.previousElementSibling;
        const nextA = taskA.elem.nextElementSibling;
        const prevB = taskB.elem.previousElementSibling;
        const nextB = taskB.elem.nextElementSibling;
        if (prevA) {
            prevA.after(taskB.elem);
        } else {
            nextA.before(taskB.elem);
        }
        if (nextB) {
            nextB.before(taskA.elem);
        } else {
            prevB.after(taskA.elem);
        }
        slideElem(taskA.elem, oldPosA - taskA.elem.offsetTop, 0);
        slideElem(taskB.elem,  oldPosB - taskB.elem.offsetTop, 0);

        // swap the tasks in the list
        [this[indexA], this[indexB]] = [this[indexB], this[indexA]];
    }

    insert(newTask, insertIndex) {
        if (Math.abs(insertIndex) > this.length ) {
            throw RangeError(`${insertIndex} is out of range of this TaskList`);
        }
        if (insertIndex < 0) {
            insertIndex = this.length + insertIndex;
        }
        if (insertIndex === this.length) {
            this.push(newTask);
        } else {
            this[insertIndex].elem.before(newTask.elem);
        }

        let swap = newTask;
        newTask.grow();
        for (let index = insertIndex; index < this.length; index++) {
            const temp = this[index];
            this[index] = swap;
            swap = temp;
            this[index].index = index;
            slideElem(swap.elem, -newTask.elem.offsetHeight, 0);
        }
        this[this.length] = swap;
    }

    shift() {
        return this.remove(0);
    }

    unshift(...newTasks) {
        if (newTasks.some(newTask => !newTask instanceof Task)) {
            throw TypeError("Cannot add a non-Task object to a TaskList");
        }
        const combinedHeight = newTasks.reduce((sum, newTask, index) => {
            this.elem.prepend(newTask.elem);
            newTask.index = index;
            super.unshift(newTask);
            return sum + newTask.elem.offsetHeight;
        }, 0);
        this.forEach((task, index) => {
            task.index = index;
            slideElem(task.elem, -combinedHeight, 0);
        });
        return this.length;
    }

    reverse() {
        for (let index = 0; index < Math.floor(this.length / 2); index++) {
            this.swap(index, this.length - index - 1);
        }
    }

    splice(start, deleteCount, ...newTasks) {
        for (let index = start + newTasks.length; index < start + deleteCount; index++) {
            this[index].elem.remove();
        }
        newTasks.forEach((newTask, index) => {
            this[start + index].elem.replaceWith(newTask.elem);
            newTask.index = start + index;
        });
        return super.splice(start, deleteCount, ...newTasks);
    }

    slice(start = 0, end = this.length) {
        const newTaskList = new TaskList();
        newTaskList.fromJSON(JSON.stringify(super.slice(start, end)));
        return newTaskList;
    }

    concat(...taskLists) {
        const combinedTaskList = new TaskList();
        taskLists.forEach(taskList => {
            combinedTaskList.append(...taskList);
        });
        return combinedTaskList;
    }

    copyWithin(target, start = 0, end= this.length) {
        if (target < 0) {
            target += this.length;
        }
        if (start < 0) {
            start += this.length;
        }
        for (let index = 0; index < end - start; index++) {
            this[target + index].name = this[start + index];
        }
        return this;
    }

    sort(compareFn) {
        // TODO: check if this works at all (probably doesn't)
        super.sort(compareFn);
        const alreadySwapped = new Set();
        this.forEach((task, index) => {
            // task.index retains its original value, from before the list was sorted
            if (task.index in alreadySwapped || index in alreadySwapped) {
                return;
            }
            alreadySwapped.add(task.index);
            alreadySwapped.add(index);
            this.swap(task.index, index, true);
        });
        super.sort(compareFn);
    }

    remove(taskRef) {
        const targetIndex = this.#validateIndex(taskRef);
        const removedTask = this[targetIndex];
        // shrink the element and then remove it
        removedTask.shrink().finished.then(() => {
            removedTask.elem.remove();
        });
        super.splice(targetIndex, 1);

        // update the indices of the tasks that follow and animate them
        this.forEach((task, index) => {
            if (index >= targetIndex - 1) {
                slideElem(task.elem, 0, -removedTask.elem.offsetHeight);
                task.index = index;
            }
        });
        return removedTask;
    }

    render() {
        this.forEach((task, index) => {
            task.index = index;
            this.elem.append(task.elem);
        });
    }

    fromJSON(source) {
        // import tasks from JSON string
        try {
            const importedTasks = JSON.parse(source) ?? [];

            importedTasks.forEach((task, index) => {
                if (task !== null && ('name' in task) && ('completed' in task)) {
                    // convert each minified task to real Task objects
                    const newTask = new Task(task.name, task.completed, index);
                    this.push(newTask);
                } else {
                    throw SyntaxError(`TaskList import source is incorrectly formatted`);
                }
            });
        } catch (err) {
            console.error('Could not import all Tasks: ', err);

            const errorTask = new Task("task import failed :(");
            errorTask.elem.classList.add('error');
            this.push(errorTask);
        }
    }
}


function save(object) {
    // convert an object to a string representation of JSON and save it to localStorage
    localStorage.setItem(COOKIE_NAME, JSON.stringify(object));
    // console.table(object);
}


/* event handlers */

function addTaskEvent(taskList, submitEv) {
    /*  Triggered when the 'add-task-form' is submitted
     *  Creates a new Task, appends it to taskList, and adds it to the DOM,
     *  taskList: an array of Task objects
     *  submitEv: an Event object
     */
    submitEv.preventDefault();
    const formElem = submitEv.currentTarget;
    const taskNameFieldElem = formElem.firstElementChild;
    randomizePlaceholder(taskNameFieldElem);

    const taskName = taskNameFieldElem.value.trim();
    // input validation
    if (taskName === "") {
        return
    }

    // add the new task to the list
    taskList.create(taskName);
    save(taskList);

    formElem.reset();
}


function clickEvent(taskList, clickEv) {
    /*  Triggered when a child of the task list element is clicked.
     *  Causes a variety of operations depending on the element that was clicked.
     *  taskList: an array of Task objects
     *  submitEv: an Event object
     */

    // remove the associated task when a delete button is pressed
    if (clickEv.target.classList.contains('delete-btn')) {
        const clickedTaskIndex = parseInt(clickEv.target.parentElement.dataset.index);
        taskList.remove(clickedTaskIndex)
        save(taskList);
    }

    // mark a task as complete when it is clicked
    else if (clickEv.target.classList.contains('task')) {
        const clickedTaskIndex = parseInt(clickEv.target.dataset.index);
        taskList[clickedTaskIndex].completed = !taskList[clickedTaskIndex].completed;
        save(tasks);
    }
}


function startDragEvent(taskList, clickEv) {
    /*  triggered when a Tasks' drag button is clicked. Causes the Task to become draggable.
     *  taskList: an array of Task objects
     *  submitEv: an Event object
     */

    // only start dragging an element when its drag button is clicked
    if (!clickEv.target.classList.contains('drag-btn')) {
        return;
    }

    const button = clickEv.target;
    const taskElement = clickEv.target.parentElement;
    const initialClientY = clickEv.clientY;
    const initialOffset = taskElement.offsetTop
    let distToSwapUp = taskElement.previousElementSibling?.offsetHeight / 2;
    let distToSwapDown = taskElement.nextElementSibling?.offsetHeight / 2;

    // update the drag button visuals
    button.setAttribute('aria-pressed', 'true');
    taskElement.classList.add('moving');

    function dragEvent(moveEv) {
        const dragDist = moveEv.clientY - initialClientY;

        // swap positions with the element below
        if (taskElement.nextElementSibling !== null && dragDist > taskElement.offsetTop - initialOffset + distToSwapDown) {
            const taskIndex = parseInt(taskElement.dataset.index);
            const swapTarget = taskList[taskIndex + 1].elem;
            distToSwapUp = swapTarget.offsetHeight / 2;
            distToSwapDown = swapTarget.nextElementSibling?.offsetHeight / 2;
            taskList.swap(taskIndex, taskIndex + 1);
            save(taskList);
        }

        // swap positions with the element above
        else if (taskElement.previousElementSibling !== null && dragDist < taskElement.offsetTop - initialOffset - distToSwapUp) {
            const taskIndex = parseInt(taskElement.dataset.index);
            const swapTarget = taskList[taskIndex - 1].elem;
            distToSwapUp = swapTarget.nextElementSibling?.offsetHeight / 2;
            distToSwapDown = swapTarget.offsetHeight / 2;
            taskList.swap(taskIndex - 1, taskIndex);
            save(taskList);
        }
    }

    document.addEventListener('mousemove', dragEvent);
    document.addEventListener('mouseup', () => {
        // clean up after the mouse is released
        document.removeEventListener('mousemove', dragEvent);
        taskElement.classList.remove('moving');
        button.setAttribute('aria-pressed', 'false');
    }, {once: true, passive: true});
}


const tasks = new TaskList()
tasks.fromJSON(localStorage.getItem(COOKIE_NAME));
document.querySelector('.add-task-form').after(tasks.elem);
// task click functionality
tasks.elem.addEventListener('click', clickEvent.bind(null, tasks));
// task drag functionality
tasks.elem.addEventListener('mousedown', startDragEvent.bind(null, tasks));
// add task form functionality
document.querySelector('.add-task-form').addEventListener('submit', addTaskEvent.bind(null, tasks));

// change the prompt to something quirky after the first visit
if (tasks.length > 0) {
    randomizePlaceholder(document.querySelector('.add-task-input'));
}
