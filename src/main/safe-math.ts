/**
 * Sandboxed expression evaluator for the calculator feature.
 * Replaces unsafe `Function()`/`eval()`. Supports + - * / % and grouping.
 */
export function safeEvaluateMath(expr: string): number | null {
  const tokens = expr.match(/(\d+\.?\d*|[+\-*/%()])/g);
  if (!tokens) return null;

  const cleaned = tokens.join('');
  if (!/^[\d+\-*/%().]+$/.test(cleaned)) return null;

  let pos = 0;

  function parseExpression(): number {
    let result = parseTerm();
    while (pos < tokens!.length && (tokens![pos] === '+' || tokens![pos] === '-')) {
      const op = tokens![pos++];
      const right = parseTerm();
      result = op === '+' ? result + right : result - right;
    }
    return result;
  }

  function parseTerm(): number {
    let result = parseFactor();
    while (
      pos < tokens!.length &&
      (tokens![pos] === '*' || tokens![pos] === '/' || tokens![pos] === '%')
    ) {
      const op = tokens![pos++];
      const right = parseFactor();
      if (op === '*') result *= right;
      else if (op === '/') {
        if (right === 0) throw new Error('Division by zero');
        result /= right;
      } else {
        result %= right;
      }
    }
    return result;
  }

  function parseFactor(): number {
    if (tokens![pos] === '-') {
      pos++;
      return -parseFactor();
    }
    if (tokens![pos] === '+') {
      pos++;
      return parseFactor();
    }
    if (tokens![pos] === '(') {
      pos++;
      const result = parseExpression();
      if (tokens![pos] !== ')') throw new Error('Mismatched parentheses');
      pos++;
      return result;
    }
    const num = parseFloat(tokens![pos]);
    if (isNaN(num)) throw new Error('Invalid token');
    pos++;
    return num;
  }

  try {
    const result = parseExpression();
    if (pos !== tokens.length) return null;
    return result;
  } catch {
    return null;
  }
}
