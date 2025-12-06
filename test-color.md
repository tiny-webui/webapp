```markdown
```html
<!doctype html>
<!-- comment --> <!-- #999988 comment -->
<div class="box" data-flag="true"> <!-- tag #00009f; attr-name #00a4db; attr-value #e3116c -->
  <span id="item">Text</span> <!-- tag #00009f; attr-name #00a4db; attr-value #e3116c -->
  <a href="https://example.com?x=1#hash">link</a> <!-- tag #00009f; attr-name #00a4db; attr-value #e3116c -->
</div> <!-- tag #00009f -->
```

```css
/* comment */ /* #999988 */
.box::before { content: "★"; color: #36acaa !important; } /* selector #00009f; string #e3116c; color literal #36acaa */
.box { border: 1px solid #dddddd; background: #f8f8f8; } /* border/bg #dddddd/#f8f8f8 */
@media screen and (max-width: 600px) { .box { color: hotpink; } } /* @media keyword #00a4db; number 600 #36acaa; selector #00009f; string hotpink #e3116c */
```

```js
// comment // #999988
const CONSTANT = 42; // keyword #00a4db; number #36acaa
let number = 123.4; // keyword #00a4db; number #36acaa
let bool = true; // boolean #36acaa
let regex = /foo(bar)?/gi; // regex #36acaa; punctuation #393A34
function greet(name) { return `Hi ${name}!`; } // function name #9a050f; return keyword #00a4db; string #e3116c
const arrow = (x = { a: 1 }) => x?.a ?? 0; // arrow fn name #9a050f; defaults/number #36acaa; operators #393A34
class MyClass {
  #privateField = 1; // number #36acaa
  static from(json) { return new MyClass(json?.value ?? null); } // class/static keywords #00a4db; function name #9a050f; null #36acaa
}
try { greet('world'); } catch (err) { console.error(err); } // try/catch keywords #00a4db; string #e3116c
```

```diff
- old line    # deleted -> color #9a050f
+ new line    # inserted -> color #36acaa
```
```
