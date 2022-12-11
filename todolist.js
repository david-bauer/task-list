const addTaskForm = document.querySelector('form');
const addTaskField = document.querySelector('#input-task');
const taskList = document.querySelector('#task-list');

const COOKIE_NAME = 'tasks';
const ANIMATION_TIMING = parseInt(getComputedStyle(document.body).getPropertyValue('--animation-timing').slice(0, -2))


function randomizePlaceholder(input) {
    // pick a randomized placeholder message for this input field
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


function save(object) {
    // convert an object to a string representation of JSON and save it to localStorage
    localStorage.setItem(COOKIE_NAME, JSON.stringify(object));
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

randomizePlaceholder(addTaskField);
const tasks = importTasks(taskList);

// add a new task event
addTaskForm.addEventListener('submit', function (event) {
    event.preventDefault();
    randomizePlaceholder(addTaskField);

    const taskText = addTaskField.value.trim();
    let newTask = new Task(taskText, false, tasks.length);

    // input validation
    if (taskText === "") {
        return
    }

    // add task to array tasks
    tasks.push(newTask);
    save(tasks);

    // add task to DOM and animate
    taskList.appendChild(newTask.elem);
    const grow = [{transform: "scaleY(0)"},
        {transform: "scaleY(1)"}];
    newTask.elem.animate(grow, ANIMATION_TIMING);
    event.target.reset();
});

// list item click events
taskList.addEventListener('click', event => {
    // remove the associated task when a delete button is pressed
    if (event.target.classList.contains('delete-btn')) {
        const clickedTaskElem = event.target.parentElement;
        const clickedTaskIndex = clickedTaskElem.dataset.index;

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
        tasks.forEach((task, index) => {
            if (index > clickedTaskIndex) {
                const travelDist = tasks[index - 1].elem.offsetTop - task.elem.offsetTop;
                slideElem(task.elem, 0, travelDist);
                task.elem.dataset.index = index - 1;
            }
        });

        // remove the task from the array of tasks
        tasks.splice(clickedTaskIndex, 1);

        // update the cookie
        save(tasks);
    }

    // mark a task as complete when it is clicked
    else if (event.target.classList.contains('task')) {
        const taskIndex = event.target.dataset.index;
        try {
            tasks[taskIndex].toggle();
            // update the cookie
            save(tasks);
        } catch (err) {
            console.error('Index mismatch between DOM and tasks: ', err);
        }
    }
});

// drag item events
taskList.addEventListener('mousedown', event => {
    // only start dragging an element when its drag button is clicked
    if (!event.target.classList.contains('drag-btn')) {
        return;
    }

    const button = event.target;
    const taskElement = event.target.parentElement;
    const initialClientY = event.clientY;
    const initialOffset = taskElement.offsetTop
    const distToSwap = taskElement.offsetHeight / 2;

    // update the drag button visuals
    button.setAttribute('aria-pressed', 'true');
    taskElement.classList.add('moving');

    function dragTask(mouseEv) {
        const dragDist = mouseEv.clientY - initialClientY;

        // swap positions with the element below
        if (taskElement.nextElementSibling !== null && dragDist > taskElement.offsetTop - initialOffset + distToSwap) {
            const taskIndex = parseInt(taskElement.dataset.index);
            const swapTarget = tasks[taskIndex + 1].elem
            const travelDist = swapTarget.offsetTop - taskElement.offsetTop;

            // update the array of tasks
            tasks.splice(taskIndex, 2, tasks[taskIndex + 1], tasks[taskIndex]);
            save(tasks);

            // update the DOM and animate the elements
            swapTarget.after(taskElement);
            slideElem(taskElement, -travelDist, 0);
            slideElem(taskElement.previousElementSibling, travelDist, 0);

            // update the index values on the elements
            taskElement.dataset.index = taskIndex + 1
            swapTarget.dataset.index = taskIndex
        }

        // swap positions with the element above
        else if (taskElement.previousElementSibling !== null && dragDist < taskElement.offsetTop - initialOffset - distToSwap) {
            const taskIndex = parseInt(taskElement.dataset.index);
            const swapTarget = tasks[taskIndex - 1].elem
            const travelDist = swapTarget.offsetTop - taskElement.offsetTop;

            // update the array of tasks
            tasks.splice(taskIndex - 1, 2, tasks[taskIndex], tasks[taskIndex - 1]);
            save(tasks);
            // console.table(tasks);

            // update the DOM and animate the elements
            swapTarget.before(taskElement);
            slideElem(taskElement, -travelDist, 0);
            slideElem(swapTarget, travelDist, 0);

            // update the index values on the elements
            taskElement.dataset.index = taskIndex - 1
            swapTarget.dataset.index = taskIndex
        }
    }

    document.addEventListener('mousemove', dragTask);
    document.addEventListener('mouseup', mouseEv => {
        // clean up after the mouse is released
        document.removeEventListener('mousemove', dragTask);
        taskElement.classList.remove('moving');
        button.setAttribute('aria-pressed', 'false');
    }, {once: true, passive: true});
});
