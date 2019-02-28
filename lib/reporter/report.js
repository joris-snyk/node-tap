const React = require('react')
const ms = require('ms')
const importJSX = require('import-jsx')
const {render, Static, Box} = require('ink')
const Parser = require('tap-parser')

const Summary = importJSX('./summary.js')
const Result = importJSX('./result.js')
const Test = importJSX('./test.js')

// little helper thing to get a single stream of filtered failures
const ParserAsserts = require('./parser-asserts.js')

// add, start, process, and end all put the test in the static summary box
// with the appropriate color, and update the assert count
// test/name.js ........................... 19/24  ${time}ms
//
// All failures get printed to the non-static results box
//
// Static:
//   - Any time there's an error, print the test name and error
//     NB: only print the actual errors, not the parent test names, since
//     that's not really providing any more than just the name.
//   - The <Result> tag should make the diffs pretty, strip out found/wanted
//     if there's a diff, diff strings nicely when there's a found/wanted
//     string.
//   - When a test ends, print the test name and summary
// Summary:
//   - show running tests
//   - number of pending tests
//   - number of errors/passes seen so far
// Final:
//   - clear Summary box, print each test to the Static box
//
// In the static section:
//
// Parser emits a child, which has a bunch of assert events, and then
// the parent emits an assert matching the child's name.
// So, ignore that post-child assertion if it's ok, or if any failures
// were seen (since the non-ok-ness is already covered)
//
// In the parser 'complete' event, look for any res.failures that were not
// already printed (particularly tapError items).
//
// Print a line for all skip/todo tests in purple.
//
// When 'end' emits on the test object, we can print the test name and its
// test.results object to get a summary.

class Report extends React.Component {
  constructor ({ tap }) {
    super()
    // pending count is tests - pass - fail
    this.state = {
      errors: [],
      tests: [],
      running: [],
      pass: [],
      fail: [],
      todo: [],
      skip: [],
      summary: null,
      counts: {
        total: 0,
        pass: 0,
        fail: 0,
        skip: 0,
        todo: 0,
      },
    }

    // XXX should this be in componentWillMount()?

    tap.on('subtestAdd', t => this.addTest(t))
    tap.on('subtestProcess', t => {
      if (!t.output && t.results && t.buffered)
        this.startTest(t)
    })
    tap.on('subtestStart', t => this.startTest(t))
    tap.on('subtestEnd', t => this.endTest(t))
    tap.on('end', () => this.endAll(tap))

    // just grab the top-level child test assertions
    tap.parser.on('assert', res =>
      !res.ok && this.setState(prevState => ({
        ...prevState,
        errors: prevState.errors.concat(res),
      })))

    // consume the text stream, but ignore it.
    // we get all we need from the child test objects.
    tap.resume()
  }

  incrementCounter (type) {
    this.setState(prevState => ({
      ...prevState,
      counts: {
        ...prevState.counts,
        total: prevState.counts.total + 1,
        [type]: prevState.counts[type] + 1,
      }
    }))
  }

  addTest (test) {
    this.setState(prevState => ({
      ...prevState,
      tests: prevState.tests.concat(test),
    }))

    test.on('end', () => this.setState(prevState => ({
      ...prevState,
      running: prevState.running.filter(t => t.name !== test.name)
    })))

    const pa = new ParserAsserts(test.parser)
    pa.name = test.name
    pa.on('pass', res => this.incrementCounter('pass'))
    pa.on('todo', res => this.incrementCounter('todo'))
    pa.on('skip', res => this.incrementCounter('skip'))
    pa.on('fail', res => this.setState(prevState => ({
      ...prevState,
      counts: {
        ...prevState.counts,
        total: prevState.counts.total + 1,
        fail: prevState.counts.fail + 1,
      },
      errors: prevState.errors.concat({
        ...res,
        testName: test.name,
      })
    })))
  }

  startTest (test) {
    this.setState(prevState => ({
      ...prevState,
      running: [
        ...(prevState.running.filter(t => t.name !== test.name)),
        test
      ]
    }))
  }

  endTest (test) {
    // put it in the appropriate bucket.
    // live update assertion handed by tap.parser event
    const ok = test.results && test.results.ok
    const bucket = ok ? 'pass' : 'fail'
    this.setState(prevState => ({
      ...prevState,
      running: prevState.running.filter(t => t.name !== test.name),
      [bucket]: prevState[bucket].concat(test),
    }))
  }

  endAll (tap) {
    this.setState(prevState => ({
      ...prevState,
      summary: tap.results
    }))
  }

  render () {
    // assign variables from state.  const {foo,...} = this.state

    return (
      <Box flexDirection="column">
        <Static>{
          this.state.errors.map((result, i) =>
            (<Result {...result} key={`${i}`} /> ))
        }</Static>

        <Box flexDirection="column">{
          this.state.running
            .sort((a, b) => a.name > b.name ? 1 : -1)
            .map(test => (<Test key={test.name} test={test} />))
        }</Box>

        { false && this.state.summary && (<Summary
          results={this.state.summary || null}
          counts={this.state.counts}
          lists={{
            fail: this.state.fail.map(t => t.name),
            pass: this.state.pass.map(t => t.name),
            todo: this.state.todo,
            skip: this.state.skip,
          }} /> )}
      </Box>
    )
  }
}

module.exports = tap => render(<Report tap={tap} />)