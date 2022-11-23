const addTaskForm = document.querySelector('form');
const addTaskField = document.querySelector('#input-task');
const taskList = document.querySelector('#task-list');

const COOKIE_NAME = 'tasks';

// pick a randomized placeholder message for the new task field every time the page is loaded
function randomizePlaceholder(input) {
    const placeholders = ['buy bananas...', 'go for a run...', 'add a task...', 'to do...', 'hug bessie...',
        'do laundry...', 'moo...', 'move to a farm...'];
    input.placeholder = placeholders[Math.round(Math.random() * placeholders.length)];
}

randomizePlaceholder(addTaskField);


class Task {
    constructor(text, completed = false) {
        /*  example list item
        <li class="task">
            <span class="task-name task-clickable">Example</span>
            <button class="drag-btn"><i class="fa-solid fa-arrows-up-down"></i></button>
            <button class="delete-btn"><i class="fa-solid fa-trash-can"></i></button>
        </li> */

        this.name = text;
        this.completed = completed;

        this.elem = document.createElement('li');
        this.elem.setAttribute('aria-checked', this.completed);
        this.elem.classList.add('task');

        this.taskName = document.createElement('span');
        this.taskName.classList.add('task-name', 'task-clickable');
        this.taskName.innerText = text;
        this.elem.appendChild(this.taskName);

        this.dragBtn = document.createElement('button');
        this.dragBtn.classList.add('drag-btn');
        const dragIcon = document.createElement('i');
        dragIcon.classList.add('fa-solid', 'fa-arrows-up-down');
        this.dragBtn.appendChild(dragIcon);
        this.elem.appendChild(this.dragBtn);

        this.deleteBtn = document.createElement('button');
        this.deleteBtn.classList.add('delete-btn');
        const trashIcon = document.createElement('i');
        trashIcon.classList.add('fa-solid', 'fa-trash-can');
        this.deleteBtn.appendChild(trashIcon);
        this.elem.appendChild(this.deleteBtn);
    }

    toggle() {
        // flip state
        this.completed = !this.completed;
        // update DOM
        this.elem.setAttribute('aria-checked', this.completed);
    }

    toJSON() {
        // minify tasks by saving only the name and state
        return {name: this.taskName.innerText, completed: this.completed};
    }
}


function save(object) {
    // convert an object to a string representation of JSON and save it to localStorage
    localStorage.setItem(COOKIE_NAME, JSON.stringify(object));
}


function importTasks() {
    // import tasks from previous sessions using cookies
    let importedTasks = [];

    try {
        // read the cookie and convert to list of objects
        importedTasks = JSON.parse(localStorage.getItem(COOKIE_NAME)) || [];

        return importedTasks.map(task => {
            if (task !== null && ('name' in task) && ('completed' in task)) {
                // convert each minified task to real Task objects
                const newTask = new Task(task.name, task.completed);
                // add the task to the DOM
                taskList.appendChild(newTask.elem);
                return newTask;
            } else {
                throw SyntaxError(`cookie ${COOKIE_NAME} is incorrectly formatted`);
            }
        });
    } catch (err) {
        console.error('Could not import tasks: ', err);
        return [];
    }
}

let tasks = importTasks();

// add a new task event
addTaskForm.addEventListener('submit', function (event) {
    event.preventDefault();
    const taskText = addTaskField.value.trim();

    let newTask = new Task(taskText, false);

    // add task to array tasks
    tasks.push(newTask);
    // add task to DOM
    taskList.appendChild(newTask.elem);
    // save task to storage
    save(tasks);
    event.target.reset();
});

// list item click events
taskList.addEventListener('click', event => {
    // remove a task
    if (event.target.classList.contains('delete-btn')) {
        // remove the task from the DOM
        event.target.parentElement.remove();
        // remove the task from the array tasks
        tasks.splice(tasks.findIndex(elem => elem.name === event.target.previousElementSibling.innerText.trim()), 1);
        // update the cookie
        save(tasks);
    }

    // mark a task as complete
    else if (event.target.classList.contains('task-clickable')) {
        try {
            // find the task in the array tasks
            const taskIndex = [...taskList.children].indexOf(event.target.parentElement);
            tasks[taskIndex].toggle();
            // update the cookie
            save(tasks);
        } catch (err) {
            console.error('Index mismatch between DOM and tasks: ', err);
        }
    } else if (event.target.classList.contains('task')) {
        try {
            // find the task in the array tasks
            const taskIndex = [...taskList.children].indexOf(event.target);
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
    if (!event.target.classList.contains('drag-btn')) {
        return;
    }

    const button = event.target;
    const taskElement = event.target.parentElement;
    const taskIndex = [...taskList.children].indexOf(taskElement);
    const initialClientY = event.clientY;
    const initialOffset = taskElement.offsetTop
    const distToSwap = taskElement.offsetHeight / 2;

    // update the drag button visuals
    button.setAttribute('aria-pressed', 'true');
    taskElement.classList.add('above');

    console.log('Element[', taskIndex, '].offsetTop: ', taskElement.offsetTop);

    function followMouse(mouseEv) {
        const dragDist = mouseEv.clientY - initialClientY;

        if (taskElement.nextElementSibling !== null && dragDist > taskElement.offsetTop - initialOffset + distToSwap) {
            // swap down
            tasks.splice(taskIndex, 2, tasks[taskIndex + 1], tasks[taskIndex]);
            taskElement.nextElementSibling.after(taskElement);
            save(tasks);

        } else if (taskElement.previousElementSibling !== null && dragDist < taskElement.offsetTop - initialOffset - distToSwap) {
            // swap up
            tasks.splice(taskIndex - 1, 2, tasks[taskIndex], tasks[taskIndex - 1]);
            taskElement.after(taskElement.previousElementSibling);
            save(tasks);
        } else {

        }
    }

    document.addEventListener('mousemove', followMouse);
    document.addEventListener('mouseup', mouseEv => {
        // when the mouse is released undo everything that happened when the mouse was first pressed
        document.removeEventListener('mousemove', followMouse);
        taskElement.classList.remove('above');
        button.setAttribute('aria-pressed', 'false');
    }, {once: true, passive: true});
});

