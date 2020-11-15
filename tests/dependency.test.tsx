import React, { Suspense, useEffect, useRef, useState } from 'react'
import { fireEvent, cleanup, render, waitFor } from '@testing-library/react'
import { Provider, atom, useAtom } from '../src/index'

const consoleError = console.error
afterEach(() => {
  cleanup()
  console.error = consoleError
})

it('works with 2 level dependencies', async () => {
  const countAtom = atom(1)
  const doubledAtom = atom((get) => get(countAtom) * 2)
  const tripledAtom = atom((get) => get(doubledAtom) * 3)

  const Counter: React.FC = () => {
    const [count, setCount] = useAtom(countAtom)
    const [doubledCount] = useAtom(doubledAtom)
    const [tripledCount] = useAtom(tripledAtom)
    const commits = useRef(1)
    useEffect(() => {
      ++commits.current
    })
    return (
      <>
        <div>
          commits: {commits.current}, count: {count}, doubled: {doubledCount},
          tripled: {tripledCount}
        </div>
        <button onClick={() => setCount((c) => c + 1)}>button</button>
      </>
    )
  }

  const { getByText, findByText } = render(
    <Provider>
      <Counter />
    </Provider>
  )

  await findByText('commits: 1, count: 1, doubled: 2, tripled: 6')

  fireEvent.click(getByText('button'))
  await findByText('commits: 2, count: 2, doubled: 4, tripled: 12')
})

it('works a primitive atom and a dependent async atom', async () => {
  const countAtom = atom(1)
  const doubledAtom = atom(async (get) => {
    await new Promise((r) => setTimeout(r, 10))
    return get(countAtom) * 2
  })

  const Counter: React.FC = () => {
    const [count, setCount] = useAtom(countAtom)
    const [doubledCount] = useAtom(doubledAtom)
    return (
      <>
        <div>
          count: {count}, doubled: {doubledCount}
        </div>
        <button onClick={() => setCount((c) => c + 1)}>button</button>
      </>
    )
  }

  const { getByText, findByText } = render(
    <Provider>
      <Suspense fallback="loading">
        <Counter />
      </Suspense>
    </Provider>
  )

  await findByText('loading')
  await findByText('count: 1, doubled: 2')

  fireEvent.click(getByText('button'))
  await findByText('loading')
  await findByText('count: 2, doubled: 4')

  fireEvent.click(getByText('button'))
  await findByText('loading')
  await findByText('count: 3, doubled: 6')
})

it('should keep an atom value even if unmounted', async () => {
  const countAtom = atom(0)
  const derivedFn = jest.fn().mockImplementation((get) => get(countAtom))
  const derivedAtom = atom(derivedFn)

  const Counter: React.FC = () => {
    const [count, setCount] = useAtom(countAtom)
    return (
      <>
        <div>count: {count}</div>
        <button onClick={() => setCount((c) => c + 1)}>button</button>
      </>
    )
  }

  const DerivedCounter: React.FC = () => {
    const [derived] = useAtom(derivedAtom)
    return <div>derived: {derived}</div>
  }

  const Parent: React.FC = () => {
    const [show, setShow] = useState(true)
    return (
      <div>
        <button onClick={() => setShow((x) => !x)}>toggle</button>
        {show ? (
          <>
            <Counter />
            <DerivedCounter />
          </>
        ) : (
          <div>hidden</div>
        )}
      </div>
    )
  }

  const { getByText } = render(
    <Provider>
      <Parent />
    </Provider>
  )

  await waitFor(() => {
    getByText('count: 0')
    getByText('derived: 0')
  })
  expect(derivedFn).toHaveReturnedTimes(1)

  fireEvent.click(getByText('button'))
  await waitFor(() => {
    getByText('count: 1')
    getByText('derived: 1')
  })
  expect(derivedFn).toHaveReturnedTimes(2)

  fireEvent.click(getByText('toggle'))
  await waitFor(() => {
    getByText('hidden')
  })
  expect(derivedFn).toHaveReturnedTimes(2)

  fireEvent.click(getByText('toggle'))
  await waitFor(() => {
    getByText('count: 1')
    getByText('derived: 1')
  })
  expect(derivedFn).toHaveReturnedTimes(2)
})

it('should keep a dependent atom value even if unmounted', async () => {
  const countAtom = atom(0)
  const derivedFn = jest.fn().mockImplementation((get) => get(countAtom))
  const derivedAtom = atom(derivedFn)

  const Counter: React.FC = () => {
    const [count, setCount] = useAtom(countAtom)
    return (
      <>
        <div>count: {count}</div>
        <button onClick={() => setCount((c) => c + 1)}>button</button>
      </>
    )
  }

  const DerivedCounter: React.FC = () => {
    const [derived] = useAtom(derivedAtom)
    return <div>derived: {derived}</div>
  }

  const Parent: React.FC = () => {
    const [showDerived, setShowDerived] = useState(true)
    return (
      <div>
        <button onClick={() => setShowDerived((x) => !x)}>toggle</button>
        {showDerived ? <DerivedCounter /> : <Counter />}
      </div>
    )
  }

  const { getByText, findByText } = render(
    <Provider>
      <Parent />
    </Provider>
  )

  await findByText('derived: 0')
  expect(derivedFn).toHaveReturnedTimes(1)

  fireEvent.click(getByText('toggle'))
  await findByText('count: 0')
  expect(derivedFn).toHaveReturnedTimes(1)

  fireEvent.click(getByText('button'))
  await findByText('count: 1')
  expect(derivedFn).toHaveReturnedTimes(1)

  fireEvent.click(getByText('toggle'))
  await findByText('derived: 1')
  expect(derivedFn).toHaveReturnedTimes(2)
})
