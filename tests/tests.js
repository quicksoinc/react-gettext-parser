/* eslint-env mocha */
/* eslint no-unused-expressions: 0 */

import { expect } from 'chai';
import { spy } from 'sinon';
import { po } from 'gettext-parser';
import fs from 'fs';
import path from 'path';

import {
  extractMessages,
  extractMessagesFromFile,
  extractMessagesFromGlob,
  toPot,
} from '../src/index.js';
import { TYPESCRIPT } from '../src';

const getSource = file => fs.readFileSync(path.join(__dirname, 'fixtures', file), 'utf8');
const getJson = file => require(`./fixtures/${file}`);

describe('react-gettext-parser', () => {

  describe('basic extraction', () => {

    it('should extract a message from jsx', () => {
      const code = getSource('SingleString.jsx');
      const messages = extractMessages(code);

      const expected = getJson('SingleString.json');

      expect(messages).to.have.length(1);
      expect(messages[0].msgid).to.equal(expected[0].msgid);
    });

    it('should extract a message from a js function call', () => {
      const code = getSource('SingleString.js');
      const messages = extractMessages(code);

      const expected = getJson('SingleString.json');

      expect(messages).to.have.length(1);
      expect(messages[0].msgid).to.equal(expected[0].msgid);
    });

    it('should extract translators\' comment attached to function call', () => {
      const code = getSource('FunctionWithComment.js');
      const messages = extractMessages(code);

      expect(messages[0].comments.extracted[0]).to.equal('A comment to translators');
      expect(messages[1].comments.extracted[0]).to.equal('Instructions inside multi-line comment');
      expect(messages[2].comments.extracted[0]).to.equal('Instructions inside block comment');
    });

    it('should do nothing when no strings are found', () => {
      const code = getSource('NoStrings.js');
      const messages = extractMessages(code);

      expect(messages).to.have.length(0);
    });

    it('should ignore empty strings', () => {
      const code = getSource('EmptyStrings.js');
      const messages = extractMessages(code);

      expect(messages).to.have.length(0);
    });

    it('should ignore non-static messages', () => {
      const code = getSource('NonStatic.js');
      const messages = extractMessages(code);

      expect(messages).to.have.length(0);
    });

    it('should support es6 template strings', () => {
      const code = getSource('Es6Strings.js');
      const messages = extractMessages(code);

      expect(messages).to.have.length(2);

      expect(messages[0].msgctxt).to.eql('context');
      expect(messages[0].msgid).to.eql('Value is: {{ value }}');
      expect(messages[0].msgid_plural).to.eql('Values are: {{ value }}');
      expect(messages[0].comments.extracted[0]).to.eql('Comment');

      expect(messages[1].msgctxt).to.eql('context');
      expect(messages[1].msgid).to.eql('One thing');
      expect(messages[1].msgid_plural).to.eql('Many things');
    });

    it('should support React children strings wrapped in JSX expressions', () => {
      const code = getSource('JsxValueStrings.jsx');
      const messages = extractMessages(code);

      expect(messages).to.have.length(2);
      expect(messages[0].msgid).to.equal(`I'm inside curly braces`);
      expect(messages[1].msgid).to.equal(`I'm inside backticks inside curly braces`);
    });

  });

  describe('plural extraction', () => {

    it('extracts plural blocks from both function calls and components', () => {
      const code = getSource('Plurals.js');
      const messages = extractMessages(code);

      expect(messages).to.have.length(2);
      expect(messages[0].msgid_plural).to.not.be.empty;
      expect(messages[0].msgstr).to.eql(['', '']);
      expect(messages[1].msgid_plural).to.not.be.empty;
      expect(messages[1].msgstr).to.eql(['', '']);
    });

  });

  describe('customization', () => {

    it('should parse strings from custom jsx components', () => {
      const messages = extractMessagesFromFile('tests/fixtures/CustomComponent.jsx', {
        componentPropsMap: {
          T: { str: 'msgid' },
        },
      });

      expect(messages).to.have.length(1);
    });

    it('should parse strings from custom js functions', () => {
      const messages = extractMessagesFromFile('tests/fixtures/CustomFunc.jsx', {
        funcArgumentsMap: {
          translate: ['msgid'],
        },
      });

      expect(messages).to.have.length(1);
    });

    it('should parse strings from object argument properties', () => {
      const messages = extractMessagesFromFile('tests/fixtures/ObjectArgumentFn.js', {
        funcArgumentsMap: {
          translate: [null, null, {
            message: 'msgid',
            messagePlural: 'msgid_plural',
            context: 'msgctxt',
            comment: 'comment',
          }],
        },
      });

      expect(messages).to.have.length(1);
      expect(messages[0].msgid).to.equal('Wow');
      expect(messages[0].msgid_plural).to.equal('Wows');
      expect(messages[0].msgctxt).to.equal('amazement');
      expect(messages[0].comments.extracted).to.have.length(1);
      expect(messages[0].comments.extracted[0]).to.equal('Be astonished');
    });

    it('should supports dynamic import()', () => {
      extractMessagesFromFile('tests/fixtures/DynamicImportCaller.js');
    });

    describe('should trim', () => {
      it('start and end whitespace when trim is true', () => {
        const messages = extractMessagesFromFile('tests/fixtures/Whitespace.jsx', {
          trim: true,
        });

        expect(messages[0].msgid).to.equal('A\n      B\n      C');
      });

      it('new-lines when trimNewlines is true', () => {
        const messages = extractMessagesFromFile('tests/fixtures/Whitespace.jsx', {
          trimNewlines: true,
        });

        expect(messages[0].msgid).to.equal('      A      B      C    ');
      });

      it('new-lines, replaced by a custom character when it is a string', () => {
        const messages = extractMessagesFromFile('tests/fixtures/Whitespace.jsx', {
          trimNewlines: 'x',
        });

        expect(messages[0].msgid).to.equal('x      Ax      Bx      Cxxx    ');
      });

      it('whitespace from each line\'s start and end when trimLines is true', () => {
        const messages = extractMessagesFromFile('tests/fixtures/Whitespace.jsx', {
          trimLines: true,
        });

        expect(messages[0].msgid).to.equal('A\nB\nC');
      });

      it('combines trimLines and trimNewlines correctly', () => {
        const messages = extractMessagesFromFile('tests/fixtures/Whitespace.jsx', {
          trimLines: true,
          trimNewlines: true,
        });

        expect(messages[0].msgid).to.equal('ABC');
      });

      it('combines trim and trimNewlines correctly', () => {
        const messages = extractMessagesFromFile('tests/fixtures/Whitespace.jsx', {
          trim: true,
          trimNewlines: true,
        });

        expect(messages[0].msgid).to.equal('A      B      C');
      });

      it('combines trim and trimLines correctly', () => {
        const messages = extractMessagesFromFile('tests/fixtures/Whitespace.jsx', {
          trim: true,
          trimLines: true,
        });

        expect(messages[0].msgid).to.equal('A\nB\nC');
      });
    });
  });

  describe('line and column number', () => {
    it('should have line and column', () => {
      const messages = extractMessagesFromFile('tests/fixtures/SingleString.js');
      expect(messages).to.have.length(1);
      const references = messages[0].comments.reference;
      expect(references[0].line).to.equal(7);
      expect(references[0].column).to.equal(6);
    });

    it('should sort with line and column order', () => {
      const messages = extractMessagesFromFile('tests/fixtures/DuplicatedStrings.jsx');
      expect(messages).to.have.length(1);

      const references = messages[0].comments.reference;
      expect(references).to.have.length(2);
      expect(references[0].line).to.equal(8);
      expect(references[1].line).to.equal(10);
      expect(references[0].column).to.equal(6);
      expect(references[1].column).to.equal(4);
    });
  });

  describe('merging identical strings', () => {
    it('should merge two identical strings and concatenate references', () => {
      const messages = extractMessagesFromGlob('tests/fixtures/Merge{A,B}.jsx');
      expect(messages).to.have.length(1);
      expect(messages[0].comments.reference).to.have.length(2);
    });

    it('should merge identical strings independant of jsx or js', () => {
      const messages = extractMessagesFromGlob('tests/fixtures/Merge{A,C}.jsx');
      expect(messages).to.have.length(1);
      expect(messages[0].comments.reference).to.have.length(2);
    });

    it('should sort references alphabetically', () => {
      const messages = extractMessagesFromGlob('tests/fixtures/Merge*.jsx');
      expect(messages).to.have.length(1);

      const references = messages[0].comments.reference;
      expect(references).to.have.length(3);
      expect(references[0].filename).to.contain('MergeA.jsx');
      expect(references[1].filename).to.contain('MergeB.jsx');
      expect(references[2].filename).to.contain('MergeC.jsx');
    });

    it('should work with both js and ts source', () => {
      const messages = extractMessagesFromGlob('tests/fixtures/Merge{A,D}.{jsx,tsx}');
      expect(messages).to.have.length(1);
      expect(messages[0].comments.reference).to.have.length(2);
    });

  });

  describe('compiling to pot', () => {

    it('should use gettext-parser', () => {
      const compileSpy = spy(po, 'compile');
      toPot(getJson('SingleString.json'));

      expect(compileSpy.called).to.equal(true);
      compileSpy.restore();
    });

    it('should spit out a pot file containing an extracted string', () => {
      const messages = getJson('SingleString.json');
      const pot = toPot(messages);
      const relevantPot = pot.split('\n\n').pop();

      const expected = getSource('SingleString.pot');

      expect(relevantPot.trim()).to.equal(expected.trim());
    });

    it('should write empty pot when given no strings', () => {
      const pot = toPot([]);
      expect(/msgid\s".+"/.test(pot)).to.equal(false);
    });

    it('should add references to pure code parsing when provided a filename', () => {
      const code = getSource('SingleString.jsx');
      const messages = extractMessages(code, { filename: 'SingleString.jsx' });
      const pot = toPot(messages);

      expect(pot).to.contain('#: SingleString.jsx');
    });

  });

  describe('typescript support', () => {

    it('should extract a message from ts', () => {
      const code = getSource('SingleString.tsx');
      const messages = extractMessages(code, { sourceType: TYPESCRIPT });
      const expected = getJson('SingleString.json');
      expect(messages).to.have.length(1);
      expect(messages[0].msgid).to.equal(expected[0].msgid);
    });

    it('should parse typescript', () => {
      const messages = extractMessagesFromFile('tests/fixtures/SingleString.ts');
      expect(messages).to.have.length(1);
      const references = messages[0].comments.reference;
      expect(references[0].line).to.equal(9);
      expect(references[0].column).to.equal(13);
    });

    it('should parse typescript with jsx', () => {
      const messages = extractMessagesFromFile('tests/fixtures/SingleString.tsx');
      expect(messages).to.have.length(1);
      const references = messages[0].comments.reference;
      expect(references[0].line).to.equal(11);
      expect(references[0].column).to.equal(4);
    });

  });

});
