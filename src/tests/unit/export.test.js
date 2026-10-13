import { describe, expect, it } from 'vitest'
import { escapeHtml } from '../../shared/utils/export'

describe('escapeHtml', () => {
  it('encodes editable content before it is placed in export HTML', () => {
    expect(escapeHtml('<img src=x onerror="alert(1)"> & \'')).toBe(
      '&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; &#39;'
    )
  })
})
