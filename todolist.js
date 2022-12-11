// constants
const COOKIE_NAME = 'tasks';
const ANIMATION_TIMING = parseInt(getComputedStyle(document.body).getPropertyValue('--animation-timing').slice(0, -2))


function randomizePlaceholder(input) {
    // set a randomized placeholder message for this input field
    const placeholders = ['buy bananas...', 'go for a run...', 'add a task...', 'to do...', 'hug bessie...',
        'do laundry...', 'moo...', 'move to a farm...', 'elope...', 'build an app...', 'make lunch...', 'call mom...'];
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

        this.name = text;
        this.completed = completed;

        this.elem = document.createElement('li');
        this.elem.setAttribute('aria-checked', this.completed);
        this.elem.classList.add('task');
        this.elem.dataset.index = index;

        this.elem.innerHTML =
            `<span class="task-name">${text}</span>` +
            '<button class="drag-btn" aria-pressed="false"><i class="fa-solid fa-arrows-up-down"></i></button>' +
            '<button class="delete-btn" aria-pressed="false"><i class="fa-solid fa-trash-can"></i></button>';
    }

    toggle() {
        // flip state
        this.completed = !this.completed;
        // update DOM
        this.elem.setAttribute('aria-checked', this.completed);
    }

    toJSON() {
        // minify tasks by saving only the name and state when JSON.stringify is called on this object
        return {name: this.name, completed: this.completed};
    }
}

// TODO: replace with Proxy object: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy
function save(object) {
    // convert an object to a string representation of JSON and save it to localStorage
    localStorage.setItem(COOKIE_NAME, JSON.stringify(object));
    console.table(object);
}


function importTasks(taskListElem) {
    // import tasks from previous sessions using cookies
    let importedTasks = [];

    try {
        // read the cookie and convert to list of objects
        importedTasks = JSON.parse(localStorage.getItem(COOKIE_NAME)) ?? [];

        return importedTasks.map((task, index) => {
            if (task !== null && ('name' in task) && ('completed' in task)) {
                // convert each minified task to real Task objects
                const newTask = new Task(task.name, task.completed, index);
                // add the task to the DOM
                taskListElem.appendChild(newTask.elem);
                return newTask;
            } else {
                throw SyntaxError(`cookie ${COOKIE_NAME} is incorrectly formatted`);
            }
        });
    } catch (err) {
        console.error('Could not import all tasks: ', err);

        const errorTask = new Task("task import failed :(");
        errorTask.elem.classList.add('error');
        taskListElem.append(errorTask.elem);

        return [errorTask];
    }
}

/* event handlers */
function addTaskEvent(taskList, submitEv) {
    /** Triggered when the 'add-task-form' is submitted
     *  Creates a new Task, appends it to taskList, and adds it to the DOM,
     *  taskList: an array of Task objects
     *  submitEv: an Event object
     */
    submitEv.preventDefault();
    const formElem = submitEv.currentTarget;
    const taskNameFieldElem = formElem.firstElementChild;
    const taskListElem = formElem.lastElementChild;
    randomizePlaceholder(taskNameFieldElem);

    const taskName = taskNameFieldElem.value.trim();
    // input validation
    if (taskName === "") {
        return
    }

    // add the new task to the list
    const newTask = new Task(taskName, false, taskList.length);
    taskList.push(newTask);
    save(taskList);

    // add the new task to the DOM and animate
    taskListElem.appendChild(newTask.elem);
    const grow = [{transform: "scaleY(0)"},
        {transform: "scaleY(1)"}];
    newTask.elem.animate(grow, ANIMATION_TIMING);
    formElem.reset();
}


function clickEvent(taskList, clickEv) {
    /** Triggered when a child of the task list element is clicked.
     *  Causes a variety of operations depending on the element that was clicked.
     *  taskList: an array of Task objects
     *  submitEv: an Event object
     */

    // remove the associated task when a delete button is pressed
    if (clickEv.target.classList.contains('delete-btn')) {
        const clickedTaskElem = clickEv.target.parentElement;
        const clickedTaskIndex = parseInt(clickedTaskElem.dataset.index);

        // shrink the task element in the DOM
        clickedTaskElem.classList.add('moving');
        const shrink = [
            {transform: "scaleY(1)"},
            {transform: "scaleY(0)"}
        ];
        clickedTaskElem.animate(shrink, ANIMATION_TIMING).finished.then(value => {
            // remove the task element from the DOM after the animation finishes
            clickedTaskElem.remove();
        });

        // move the rest of the tasks up and update their indices
        taskList.forEach((task, index) => {
            if (index > clickedTaskIndex) {
                const travelDist = taskList[index - 1].elem.offsetTop - task.elem.offsetTop;
                slideElem(task.elem, 0, travelDist);
                task.elem.dataset.index = (index - 1).toString();
            }
        });

        // remove the task from the array of tasks
        taskList.splice(clickedTaskIndex, 1);
        save(taskList);
    }

    // mark a task as complete when it is clicked
    else if (clickEv.target.classList.contains('task')) {
        const taskIndex = clickEv.target.dataset.index;
        try {
            tasks[taskIndex].toggle();
            save(tasks);
        } catch (err) {
            console.error('Index mismatch between DOM and tasks: ', err);
        }
    }
}


function startDragEvent(taskList, clickEv) {
    /** triggered when a Tasks's drag button is clicked. Causes the Task to become draggable.
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
            const swapTarget = taskList[taskIndex + 1].elem
            distToSwapUp = swapTarget.offsetHeight / 2;
            distToSwapDown = swapTarget.nextElementSibling?.offsetHeight / 2;

            // update the array of tasks
            taskList.splice(taskIndex, 2, tasks[taskIndex + 1], tasks[taskIndex]);
            save(taskList);

            // update the DOM and animate the elements
            swapTarget.after(taskElement);
            slideElem(taskElement, -swapTarget.offsetHeight, 0);
            slideElem(swapTarget, taskElement.offsetHeight, 0);

            // update the index values on the elements
            taskElement.dataset.index = (taskIndex + 1).toString();
            swapTarget.dataset.index = taskIndex.toString();
        }

        // swap positions with the element above
        else if (taskElement.previousElementSibling !== null && dragDist < taskElement.offsetTop - initialOffset - distToSwapUp) {
            const taskIndex = parseInt(taskElement.dataset.index);
            const swapTarget = taskList[taskIndex - 1].elem
            distToSwapUp = swapTarget.nextElementSibling?.offsetHeight / 2;
            distToSwapDown = swapTarget.offsetHeight / 2;

            // update the array of tasks
            taskList.splice(taskIndex - 1, 2, taskList[taskIndex], taskList[taskIndex - 1]);
            save(taskList);

            // update the DOM and animate the elements
            swapTarget.before(taskElement);
            slideElem(taskElement, swapTarget.offsetHeight, 0);
            slideElem(swapTarget, -taskElement.offsetHeight, 0);

            // update the index values on the elements
            taskElement.dataset.index = (taskIndex - 1).toString();
            swapTarget.dataset.index = taskIndex.toString();
        }
    }

    document.addEventListener('mousemove', dragEvent);
    document.addEventListener('mouseup', releaseEv => {
        // clean up after the mouse is released
        document.removeEventListener('mousemove', dragEvent);
        taskElement.classList.remove('moving');
        button.setAttribute('aria-pressed', 'false');
    }, {once: true, passive: true});
}


const taskListElem = document.querySelector('.task-list');
const tasks = importTasks(taskListElem);
// change the prompt to something quirky after the first visit
if (tasks.length > 0) {
    randomizePlaceholder(document.querySelector('.add-task-input'));
}
// add task form functionality
document.querySelector('.add-task-form').addEventListener('submit', addTaskEvent.bind(null, tasks));
// task click functionality
taskListElem.addEventListener('click', clickEvent.bind(null, tasks));
// task drag functionality
taskListElem.addEventListener('mousedown', startDragEvent.bind(null, tasks));
