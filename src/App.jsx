import { useCallback, useEffect, useRef, useState } from 'react'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import { supabase } from './supabaseClient'
import * as api from './api'

const columns = [
  { status: 'todo', title: 'To Do', accent: 'bg-slate-300' },
  { status: 'inprogress', title: 'In Progress', accent: 'bg-slate-500' },
  { status: 'done', title: 'Done', accent: 'bg-accent-600' },
]

const DEFAULT_CATEGORY_COLOR = '#6b7280'

function hexToRgba(hex, alpha) {
  const normalized = hex.replace('#', '')
  const bigint = parseInt(normalized, 16)
  const r = (bigint >> 16) & 255
  const g = (bigint >> 8) & 255
  const b = bigint & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function getTagStyle(color) {
  const resolved = color || DEFAULT_CATEGORY_COLOR
  return { backgroundColor: hexToRgba(resolved, 0.15), color: resolved }
}

const EMPTY_SELECTION = { name: '', isNew: false, color: null }

function categoryToSelection(categories, tagName) {
  if (!tagName) return EMPTY_SELECTION
  const category = categories.find((c) => c.name === tagName)
  return category
    ? { name: category.name, isNew: false, color: category.color }
    : { name: tagName, isNew: true, color: DEFAULT_CATEGORY_COLOR }
}

function CategoryDropdown({ categories, selection, onChange, onDeleteCategory }) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef(null)

  useEffect(() => {
    if (!isOpen) return
    const handleOutsideClick = (e) => {
      if (!containerRef.current?.contains(e.target)) setIsOpen(false)
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [isOpen])

  const selectedCategory = !selection.isNew
    ? categories.find((c) => c.name === selection.name)
    : null

  const handleSelectNone = () => {
    onChange(EMPTY_SELECTION)
    setIsOpen(false)
  }

  const handleSelectExisting = (category) => {
    onChange({ name: category.name, isNew: false, color: category.color })
    setIsOpen(false)
  }

  const handleSelectNew = () => {
    onChange({ name: '', isNew: true, color: DEFAULT_CATEGORY_COLOR })
    setIsOpen(false)
  }

  const handleDeleteCategory = (e, categoryName) => {
    e.stopPropagation()
    onDeleteCategory(categoryName)
    if (!selection.isNew && selection.name === categoryName) {
      onChange(EMPTY_SELECTION)
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="flex w-full items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-accent-400"
      >
        {selection.isNew ? (
          <span className="text-slate-500">New category…</span>
        ) : selectedCategory ? (
          <>
            <span
              className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
              style={{ backgroundColor: selectedCategory.color }}
            />
            <span>{selectedCategory.name}</span>
          </>
        ) : (
          <span className="text-slate-400">No tag</span>
        )}
        <span className="ml-auto text-slate-400">▾</span>
      </button>
      {isOpen && (
        <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg">
          <button
            type="button"
            onClick={handleSelectNone}
            className="block w-full px-3 py-2 text-left text-sm text-slate-500 hover:bg-slate-50"
          >
            No tag
          </button>
          <div className="max-h-56 overflow-y-auto">
            {categories.map((category) => (
              <div key={category.name} className="flex items-center">
                <button
                  type="button"
                  onClick={() => handleSelectExisting(category)}
                  className="flex flex-1 items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                >
                  <span
                    className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                    style={{ backgroundColor: category.color }}
                  />
                  {category.name}
                </button>
                <button
                  type="button"
                  onClick={(e) => handleDeleteCategory(e, category.name)}
                  aria-label={`Delete category ${category.name}`}
                  className="px-2 text-slate-400 hover:text-red-500"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={handleSelectNew}
            className="block w-full border-t border-slate-100 px-3 py-2 text-left text-sm font-medium text-accent-600 hover:bg-accent-50"
          >
            + New category…
          </button>
        </div>
      )}
    </div>
  )
}

function ColorPickerField({ color, onChange }) {
  const resolved = color || DEFAULT_CATEGORY_COLOR
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={resolved}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Category color"
        className="h-8 w-12 cursor-pointer rounded border border-slate-200 bg-white p-0.5"
      />
      <span className="font-mono text-xs text-slate-500">{resolved.toUpperCase()}</span>
    </div>
  )
}

function CategoryPicker({ categories, selection, onChange, onDeleteCategory }) {
  return (
    <div className="flex flex-col gap-2">
      <CategoryDropdown
        categories={categories}
        selection={selection}
        onChange={onChange}
        onDeleteCategory={onDeleteCategory}
      />
      {selection.isNew && (
        <div className="flex flex-col gap-2 rounded-md border border-slate-200 bg-slate-50 p-4">
          <input
            type="text"
            value={selection.name}
            onChange={(e) => onChange({ ...selection, name: e.target.value })}
            placeholder="New category name"
            className="min-w-0 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-accent-400"
          />
          <ColorPickerField
            color={selection.color}
            onChange={(newColor) => onChange({ ...selection, color: newColor })}
          />
        </div>
      )}
    </div>
  )
}

function resolveTagSelection(selection, categories, onCreateCategory) {
  const trimmedName = selection.name.trim()
  if (!trimmedName) return ''

  if (!selection.isNew) return trimmedName

  const existing = categories.find((c) => c.name.toLowerCase() === trimmedName.toLowerCase())
  if (existing) return existing.name

  onCreateCategory({ name: trimmedName, color: selection.color ?? DEFAULT_CATEGORY_COLOR })
  return trimmedName
}

function TaskEditForm({ task, categories, onSave, onCancel, onCreateCategory, onDeleteCategory }) {
  const [draftTitle, setDraftTitle] = useState(task.title)
  const [draftDescription, setDraftDescription] = useState(task.description ?? '')
  const [draftTagSelection, setDraftTagSelection] = useState(() =>
    categoryToSelection(categories, task.tag)
  )

  const handleSave = () => {
    const trimmedTitle = draftTitle.trim()
    if (!trimmedTitle) return
    const tag = resolveTagSelection(draftTagSelection, categories, onCreateCategory)
    onSave({
      title: trimmedTitle,
      description: draftDescription.trim(),
      tag,
    })
  }

  return (
    <div className="flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
      <input
        type="text"
        value={draftTitle}
        onChange={(e) => setDraftTitle(e.target.value)}
        placeholder="Task title"
        className="min-w-0 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-accent-400"
      />
      <input
        type="text"
        value={draftDescription}
        onChange={(e) => setDraftDescription(e.target.value)}
        placeholder="Description (optional)"
        className="min-w-0 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-accent-400"
      />
      <CategoryPicker
        categories={categories}
        selection={draftTagSelection}
        onChange={setDraftTagSelection}
        onDeleteCategory={onDeleteCategory}
      />
      <div className="mt-1 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          className="rounded-md bg-accent-600 px-4 py-2 text-sm font-medium text-white hover:bg-accent-700"
        >
          Save
        </button>
      </div>
    </div>
  )
}

function TaskCard({
  task,
  index,
  isEditing,
  canEdit,
  categories,
  onDelete,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onCreateCategory,
  onDeleteCategory,
}) {
  const category = categories.find((c) => c.name === task.tag)
  const isInteractive = canEdit && !isEditing

  return (
    <Draggable draggableId={String(task.id)} index={index} isDragDisabled={!canEdit || isEditing}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...(isInteractive ? provided.dragHandleProps : {})}
          onClick={() => isInteractive && onStartEdit(task.id)}
          className={`relative rounded-lg bg-white p-4 border border-slate-200 transition-colors ${
            isInteractive ? 'hover:border-accent-300' : ''
          } ${
            snapshot.isDragging ? 'shadow-md border-accent-300' : ''
          } ${isInteractive ? 'cursor-pointer' : ''}`}
        >
          {isEditing ? (
            <TaskEditForm
              task={task}
              categories={categories}
              onSave={(fields) => onSaveEdit(task.id, fields)}
              onCancel={onCancelEdit}
              onCreateCategory={onCreateCategory}
              onDeleteCategory={onDeleteCategory}
            />
          ) : (
            <>
              {canEdit && (
                <div className="absolute top-2 right-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onStartEdit(task.id)
                    }}
                    aria-label="Edit task"
                    className="text-slate-400 hover:text-slate-600 leading-none text-sm"
                  >
                    ✎
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onDelete(task.id)
                    }}
                    aria-label="Delete task"
                    className="text-slate-400 hover:text-slate-600 leading-none text-sm"
                  >
                    ×
                  </button>
                </div>
              )}
              {task.tag && (
                <span
                  className="inline-block rounded-full px-2 py-0.5 text-xs font-medium"
                  style={getTagStyle(category?.color)}
                >
                  {task.tag}
                </span>
              )}
              <h3 className="mt-2 pr-8 font-semibold text-slate-800">{task.title}</h3>
              {task.description && (
                <p className="mt-1 text-sm text-slate-500">{task.description}</p>
              )}
            </>
          )}
        </div>
      )}
    </Draggable>
  )
}

function Column({
  status,
  title,
  accent,
  tasks,
  categories,
  editingTaskId,
  canEdit,
  onAddTask,
  onDeleteTask,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onCreateCategory,
  onDeleteCategory,
}) {
  const [newTitle, setNewTitle] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newTagSelection, setNewTagSelection] = useState(EMPTY_SELECTION)

  const handleAdd = () => {
    const trimmedTitle = newTitle.trim()
    if (!trimmedTitle) return
    const tag = resolveTagSelection(newTagSelection, categories, onCreateCategory)
    onAddTask(status, {
      title: trimmedTitle,
      description: newDescription.trim(),
      tag,
    })
    setNewTitle('')
    setNewDescription('')
    setNewTagSelection(EMPTY_SELECTION)
  }

  return (
    <div className="flex w-80 flex-shrink-0 flex-col rounded-xl bg-slate-100 p-4">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${accent}`} />
          <h2 className="font-semibold text-slate-700">{title}</h2>
        </div>
        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">
          {tasks.length}
        </span>
      </div>
      <Droppable droppableId={status}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`flex flex-col gap-2 rounded-lg min-h-12 ${
              snapshot.isDraggingOver ? 'bg-slate-200/60' : ''
            }`}
          >
            {tasks.map((task, index) => (
              <TaskCard
                key={task.id}
                task={task}
                index={index}
                isEditing={task.id === editingTaskId}
                canEdit={canEdit}
                categories={categories}
                onDelete={onDeleteTask}
                onStartEdit={onStartEdit}
                onSaveEdit={onSaveEdit}
                onCancelEdit={onCancelEdit}
                onCreateCategory={onCreateCategory}
                onDeleteCategory={onDeleteCategory}
              />
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
      {canEdit && (
        <div className="mt-4 flex flex-col gap-2">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder="Task title"
            className="min-w-0 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-accent-400"
          />
          <input
            type="text"
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder="Description (optional)"
            className="min-w-0 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-accent-400"
          />
          <CategoryPicker
            categories={categories}
            selection={newTagSelection}
            onChange={setNewTagSelection}
            onDeleteCategory={onDeleteCategory}
          />
          <button
            type="button"
            onClick={handleAdd}
            className="rounded-md bg-accent-600 px-4 py-2 text-sm font-medium text-white hover:bg-accent-700"
          >
            Add
          </button>
        </div>
      )}
    </div>
  )
}

function CategoryEditRow({ category, onSave, onCancel }) {
  const [name, setName] = useState(category.name)
  const [color, setColor] = useState(category.color)

  const handleSave = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    onSave({ name: trimmed, color })
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-slate-200 bg-slate-50 p-4">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleSave()}
        placeholder="Category name"
        className="min-w-0 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-accent-400"
      />
      <div className="flex items-center gap-2">
        <ColorPickerField color={color} onChange={setColor} />
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="rounded-md bg-accent-600 px-4 py-2 text-sm font-medium text-white hover:bg-accent-700"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

function CategoryManagerModal({
  categories,
  onCreateCategory,
  onUpdateCategory,
  onDeleteCategory,
  onClose,
}) {
  const [name, setName] = useState('')
  const [color, setColor] = useState(DEFAULT_CATEGORY_COLOR)
  const [editingName, setEditingName] = useState(null)

  const handleAdd = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    onCreateCategory({ name: trimmed, color })
    setName('')
    setColor(DEFAULT_CATEGORY_COLOR)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">Manage Categories</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-slate-400 hover:text-slate-600"
          >
            ×
          </button>
        </div>
        <div className="mb-4 flex max-h-64 flex-col gap-2 overflow-y-auto">
          {categories.length === 0 && (
            <p className="text-sm text-slate-400">No categories yet.</p>
          )}
          {categories.map((category) =>
            editingName === category.name ? (
              <CategoryEditRow
                key={category.name}
                category={category}
                onSave={(fields) => {
                  onUpdateCategory(category.name, fields)
                  setEditingName(null)
                }}
                onCancel={() => setEditingName(null)}
              />
            ) : (
              <div
                key={category.name}
                className="flex items-center justify-between rounded-md border border-slate-100 px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                    style={{ backgroundColor: category.color }}
                  />
                  <span className="text-sm text-slate-700">{category.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingName(category.name)}
                    aria-label={`Edit category ${category.name}`}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    ✎
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteCategory(category.name)}
                    aria-label={`Delete category ${category.name}`}
                    className="text-slate-400 hover:text-red-500"
                  >
                    ×
                  </button>
                </div>
              </div>
            )
          )}
        </div>
        <div className="flex flex-col gap-2 border-t border-slate-100 pt-4">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder="New category name"
            className="min-w-0 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-accent-400"
          />
          <div className="flex items-center gap-2">
            <ColorPickerField color={color} onChange={setColor} />
            <button
              type="button"
              onClick={handleAdd}
              className="ml-auto rounded-md bg-accent-600 px-4 py-2 text-sm font-medium text-white hover:bg-accent-700"
            >
              Add
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function App() {
  const [tasks, setTasks] = useState([])
  const [categories, setCategories] = useState([])
  const [editingTaskId, setEditingTaskId] = useState(null)
  const [isManagingCategories, setIsManagingCategories] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [writeError, setWriteError] = useState(null)
  const [session, setSession] = useState(null)
  const [isUnlockFormOpen, setIsUnlockFormOpen] = useState(false)
  const [emailInput, setEmailInput] = useState('')
  const [passwordInput, setPasswordInput] = useState('')
  const [unlockError, setUnlockError] = useState(null)

  const isEditMode = !!session

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      api.setAccessToken(data.session?.access_token)
      setSession(data.session)
    })

    const { data } = supabase.auth.onAuthStateChange((_event, newSession) => {
      api.setAccessToken(newSession?.access_token)
      setSession(newSession)
    })

    return () => data.subscription.unsubscribe()
  }, [])

  const loadBoard = useCallback(
    () =>
      api.getBoard().then(
        (board) => {
          setLoadError(null)
          setCategories(board.categories)
          setTasks(board.tasks)
          setIsLoading(false)
        },
        (error) => {
          console.error(error)
          setLoadError('Failed to load the board from the API.')
          setIsLoading(false)
        }
      ),
    []
  )

  useEffect(() => {
    loadBoard()
  }, [loadBoard])

  const handleWriteError = (message, error) => {
    console.error(message, error)
    setWriteError(`${message}: ${error.message}`)
    loadBoard()
  }

  const handleAddTask = async (status, { title, description, tag }) => {
    if (!isEditMode) return
    const columnOrders = tasks.filter((task) => task.status === status).map((task) => task.order)
    const nextOrder = columnOrders.length ? Math.max(...columnOrders) + 1 : 0

    try {
      const task = await api.createTask({ title, description, tag, status, order: nextOrder })
      setTasks((prev) => [...prev, task])
    } catch (error) {
      handleWriteError('Failed to create task', error)
    }
  }

  const handleDeleteTask = (id) => {
    if (!isEditMode) return
    setTasks((prev) => prev.filter((task) => task.id !== id))
    api.deleteTask(id).catch((error) => handleWriteError('Failed to delete task', error))
  }

  const handleStartEdit = (id) => {
    setEditingTaskId(id)
  }

  const handleSaveEdit = (id, { title, description, tag }) => {
    if (!isEditMode) return
    setTasks((prev) =>
      prev.map((task) => (task.id === id ? { ...task, title, description, tag } : task))
    )
    setEditingTaskId(null)
    api
      .updateTask(id, { title, description, tag })
      .catch((error) => handleWriteError('Failed to update task', error))
  }

  const handleCancelEdit = () => {
    setEditingTaskId(null)
  }

  const handleCreateCategory = async ({ name, color }) => {
    if (!isEditMode) return
    if (categories.some((category) => category.name.toLowerCase() === name.toLowerCase())) {
      return
    }

    try {
      const category = await api.createCategory({ name, color })
      setCategories((prev) => [...prev, category])
    } catch (error) {
      handleWriteError('Failed to create category', error)
    }
  }

  const handleDeleteCategory = (name) => {
    if (!isEditMode) return
    setCategories((prev) => prev.filter((category) => category.name !== name))
    api.deleteCategory(name).catch((error) => handleWriteError('Failed to delete category', error))
  }

  const handleUpdateCategory = (oldName, { name, color }) => {
    if (!isEditMode) return
    const trimmedName = name.trim()
    if (!trimmedName) return

    const collides = categories.some(
      (category) => category.name !== oldName && category.name.toLowerCase() === trimmedName.toLowerCase()
    )
    if (collides) return

    setCategories((prev) =>
      prev.map((category) =>
        category.name === oldName ? { ...category, name: trimmedName, color } : category
      )
    )

    if (trimmedName !== oldName) {
      setTasks((prev) =>
        prev.map((task) => (task.tag === oldName ? { ...task, tag: trimmedName } : task))
      )
    }

    // The server cascades a rename to tasks.tag.
    api
      .updateCategory(oldName, { name: trimmedName, color })
      .catch((error) => handleWriteError('Failed to update category', error))
  }

  const handleDragEnd = (result) => {
    if (!isEditMode) return
    const { source, destination, draggableId } = result
    if (!destination) return

    const sourceStatus = source.droppableId
    const destStatus = destination.droppableId

    const destTasks = tasks
      .filter((task) => task.status === destStatus && task.id !== draggableId)
      .sort((a, b) => a.order - b.order)

    const draggedTask = tasks.find((task) => task.id === draggableId)
    destTasks.splice(destination.index, 0, draggedTask)

    const destOrderById = new Map(destTasks.map((task, index) => [task.id, index]))

    let sourceOrderById = new Map()
    if (sourceStatus !== destStatus) {
      const sourceTasks = tasks
        .filter((task) => task.status === sourceStatus && task.id !== draggableId)
        .sort((a, b) => a.order - b.order)
      sourceOrderById = new Map(sourceTasks.map((task, index) => [task.id, index]))
    }

    const updatedTasks = tasks.map((task) => {
      if (destOrderById.has(task.id)) {
        return { ...task, status: destStatus, order: destOrderById.get(task.id) }
      }
      if (sourceOrderById.has(task.id)) {
        return { ...task, order: sourceOrderById.get(task.id) }
      }
      return task
    })

    setTasks(updatedTasks)

    const changedTasks = updatedTasks.filter((task, i) => {
      const original = tasks[i]
      return task.order !== original.order || task.status !== original.status
    })

    if (changedTasks.length === 0) return

    api
      .reorderTasks(changedTasks.map(({ id, status, order }) => ({ id, status, order })))
      .catch((error) => handleWriteError('Failed to persist task order', error))
  }

  const handleClearAll = () => {
    if (!isEditMode) return
    const confirmed = window.confirm(
      'Delete all tasks and categories? This cannot be undone.'
    )
    if (!confirmed) return

    setTasks([])
    setCategories([])
    setEditingTaskId(null)

    api.clearBoard().catch((error) => handleWriteError('Failed to clear the board', error))
  }

  const handleUnlockSubmit = async (e) => {
    e.preventDefault()
    const { error } = await supabase.auth.signInWithPassword({
      email: emailInput,
      password: passwordInput,
    })
    if (error) {
      setUnlockError(error.message)
      return
    }
    setIsUnlockFormOpen(false)
    setEmailInput('')
    setPasswordInput('')
    setUnlockError(null)
  }

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) setWriteError(`Failed to sign out: ${error.message}`)
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-slate-800">Kanban Board</h1>
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              isEditMode ? 'bg-accent-100 text-accent-700' : 'bg-slate-200 text-slate-600'
            }`}
          >
            {isEditMode ? 'Edit mode' : 'Read-only'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isEditMode ? (
            <>
              <button
                type="button"
                onClick={() => setIsManagingCategories(true)}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Manage Categories
              </button>
              <button
                type="button"
                onClick={handleClearAll}
                className="rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
              >
                Clear All
              </button>
              <button
                type="button"
                onClick={handleSignOut}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Sign out
              </button>
            </>
          ) : isUnlockFormOpen ? (
            <form onSubmit={handleUnlockSubmit} className="flex items-center gap-2">
              <input
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="Email"
                autoComplete="email"
                required
                autoFocus
                className="w-48 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-accent-400"
              />
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="Password"
                autoComplete="current-password"
                required
                className="w-32 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-accent-400"
              />
              <button
                type="submit"
                className="rounded-md bg-accent-600 px-4 py-2 text-sm font-medium text-white hover:bg-accent-700"
              >
                Unlock
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsUnlockFormOpen(false)
                  setEmailInput('')
                  setPasswordInput('')
                  setUnlockError(null)
                }}
                className="text-sm font-medium text-slate-500 hover:text-slate-700"
              >
                Cancel
              </button>
              {unlockError && <span className="text-xs text-red-600">{unlockError}</span>}
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setIsUnlockFormOpen(true)}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Unlock Editing
            </button>
          )}
        </div>
      </div>
      {loadError && <p className="mb-4 text-sm text-red-600">{loadError}</p>}
      {writeError && (
        <div className="mb-4 flex items-center gap-2 text-sm text-red-600">
          <p>{writeError}</p>
          <button
            type="button"
            onClick={() => setWriteError(null)}
            aria-label="Dismiss error"
            className="text-red-400 hover:text-red-600"
          >
            ×
          </button>
        </div>
      )}
      {isLoading ? (
        <p className="text-sm text-slate-500">Loading board…</p>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="flex gap-6 overflow-x-auto">
            {columns.map((column) => (
              <Column
                key={column.status}
                status={column.status}
                title={column.title}
                accent={column.accent}
                tasks={tasks
                  .filter((task) => task.status === column.status)
                  .sort((a, b) => a.order - b.order)}
                categories={categories}
                editingTaskId={editingTaskId}
                canEdit={isEditMode}
                onAddTask={handleAddTask}
                onDeleteTask={handleDeleteTask}
                onStartEdit={handleStartEdit}
                onSaveEdit={handleSaveEdit}
                onCancelEdit={handleCancelEdit}
                onCreateCategory={handleCreateCategory}
                onDeleteCategory={handleDeleteCategory}
              />
            ))}
          </div>
        </DragDropContext>
      )}
      {isEditMode && isManagingCategories && (
        <CategoryManagerModal
          categories={categories}
          onCreateCategory={handleCreateCategory}
          onUpdateCategory={handleUpdateCategory}
          onDeleteCategory={handleDeleteCategory}
          onClose={() => setIsManagingCategories(false)}
        />
      )}
    </div>
  )
}

export default App
