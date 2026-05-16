import { execFileSync } from 'node:child_process';

function runPowershell(script: string): string {
  const encoded = Buffer.from(script, 'utf-16le').toString('base64');
  const result = execFileSync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-EncodedCommand', encoded],
    {
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024,
      timeout: 30_000,
      windowsHide: true,
    },
  );
  return result.trim();
}

export interface OutlookEmail {
  index: number;
  subject: string;
  from: string;
  to: string;
  received: string;
  body: string;
  hasAttachments: boolean;
  unread: boolean;
  folder: string;
}

export function listEmails(folder: string, maxCount: number): OutlookEmail[] {
  const script = `
$outlook = New-Object -ComObject Outlook.Application
$ns = $outlook.GetNamespace("MAPI")
$folder = $ns.Folders.Item(1).Folders | Where-Object { $_.Name -eq '${folder.replace(/'/g, "''")}' }
if (-not $folder) { $folder = $ns.GetDefaultFolder(6) }
$items = $folder.Items
$items.Sort("[ReceivedTime]", $true)
$max = [Math]::Min($items.Count, ${maxCount})
$results = @()
for ($i = 1; $i -le $max; $i++) {
  $item = $items.Item($i)
  $results += [PSCustomObject]@{
    index = $i
    subject = $item.Subject
    from = $item.SenderName
    to = $item.To
    received = $item.ReceivedTime.ToString('yyyy-MM-dd HH:mm')
    body = if ($item.Body) { $item.Body.Substring(0, [Math]::Min($item.Body.Length, 500)) } else { '' }
    hasAttachments = ($item.Attachments.Count -gt 0)
    unread = ($item.UnRead -eq $true)
    folder = $folder.Name
  }
}
$results | ConvertTo-Json -Compress
`;
  const output = runPowershell(script);
  if (!output) return [];
  return JSON.parse(output);
}

export function readEmail(index: number, folder: string): OutlookEmail | null {
  const script = `
$outlook = New-Object -ComObject Outlook.Application
$ns = $outlook.GetNamespace("MAPI")
$folder = $ns.Folders.Item(1).Folders | Where-Object { $_.Name -eq '${folder.replace(/'/g, "''")}' }
if (-not $folder) { $folder = $ns.GetDefaultFolder(6) }
$items = $folder.Items
$items.Sort("[ReceivedTime]", $true)
if (${index} -gt $items.Count) { Write-Output "null"; exit }
$item = $items.Item(${index})
$result = [PSCustomObject]@{
  index = ${index}
  subject = $item.Subject
  from = $item.SenderName + ' <' + $item.SenderEmailAddress + '>'
  to = $item.To
  cc = $item.CC
  received = $item.ReceivedTime.ToString('yyyy-MM-dd HH:mm')
  body = $item.Body
  htmlBody = $item.HTMLBody
  hasAttachments = ($item.Attachments.Count -gt 0)
  attachments = @($item.Attachments | ForEach-Object { $_.FileName })
  unread = ($item.UnRead -eq $true)
  folder = $folder.Name
}
$result | ConvertTo-Json -Compress -Depth 2
`;
  const output = runPowershell(script);
  if (!output || output === 'null') return null;
  return JSON.parse(output);
}

export function sendEmail(
  to: string,
  subject: string,
  body: string,
  cc?: string,
  bcc?: string,
  attachments?: string[],
): { sent: boolean; message: string } {
  const bodyB64 = Buffer.from(body, 'utf-8').toString('base64');
  const attachScript = attachments?.length
    ? attachments
        .map(
          (p, i) =>
            `$mail.Attachments.Add('${p.replace(/'/g, "''")}') | Out-Null; Write-Output "Attached: ${p.replace(/'/g, "''")}"`,
        )
        .join('\n')
    : '';
  const script = `
$body = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${bodyB64}'))
$outlook = New-Object -ComObject Outlook.Application
$mail = $outlook.CreateItem(0)
$mail.To = '${to.replace(/'/g, "''")}'
$mail.Subject = '${subject.replace(/'/g, "''")}'
$mail.Body = $body
${cc ? `$mail.CC = '${cc.replace(/'/g, "''")}'` : ''}
${bcc ? `$mail.BCC = '${bcc.replace(/'/g, "''")}'` : ''}
${attachScript}
$mail.Send()
Write-Output '{"sent":true,"message":"Email sent successfully"}'
`;
  const output = runPowershell(script);
  return JSON.parse(output);
}

export function getAttachments(
  index: number,
  folder: string,
): { name: string; path: string; size: number }[] {
  const script = `
$outlook = New-Object -ComObject Outlook.Application
$ns = $outlook.GetNamespace("MAPI")
$folder = $ns.Folders.Item(1).Folders | Where-Object { $_.Name -eq '${folder.replace(/'/g, "''")}' }
if (-not $folder) { $folder = $ns.GetDefaultFolder(6) }
$items = $folder.Items
$items.Sort("[ReceivedTime]", $true)
if (${index} -gt $items.Count) { Write-Output "[]"; exit }
$item = $items.Item(${index})
$results = @()
$tmpDir = [System.IO.Path]::GetTempPath()
foreach ($att in $item.Attachments) {
  $safePath = Join-Path $tmpDir $att.FileName
  try { $att.SaveAsFile($safePath) } catch {}
  $results += [PSCustomObject]@{
    name = $att.FileName
    path = $safePath
    size = $att.Size
  }
}
$results | ConvertTo-Json -Compress
`;
  const output = runPowershell(script);
  if (!output) return [];
  return JSON.parse(output);
}

export function searchEmails(query: string, folder: string, maxCount: number): OutlookEmail[] {
  const script = `
$outlook = New-Object -ComObject Outlook.Application
$ns = $outlook.GetNamespace("MAPI")
$folder = $ns.Folders.Item(1).Folders | Where-Object { $_.Name -eq '${folder.replace(/'/g, "''")}' }
if (-not $folder) { $folder = $ns.GetDefaultFolder(6) }
$items = $folder.Items
$items.Sort("[ReceivedTime]", $true)
$query = '*${query.replace(/'/g, "''")}*'
$filtered = @($items | Where-Object { $_.Subject -like $query -or $_.Body -like $query -or $_.SenderName -like $query })
$max = [Math]::Min($filtered.Count, ${maxCount})
$results = @()
for ($i = 0; $i -lt $max; $i++) {
  $item = $filtered[$i]
  $results += [PSCustomObject]@{
    index = $i + 1
    subject = $item.Subject
    from = $item.SenderName
    to = $item.To
    received = $item.ReceivedTime.ToString('yyyy-MM-dd HH:mm')
    body = if ($item.Body) { $item.Body.Substring(0, [Math]::Min($item.Body.Length, 300)) } else { '' }
    hasAttachments = ($item.Attachments.Count -gt 0)
    unread = ($item.UnRead -eq $true)
    folder = $folder.Name
  }
}
$results | ConvertTo-Json -Compress
`;
  const output = runPowershell(script);
  if (!output) return [];
  return JSON.parse(output);
}

export function listFolders(): { name: string; count: number; unread: number }[] {
  const script = `
$outlook = New-Object -ComObject Outlook.Application
$ns = $outlook.GetNamespace("MAPI")
$results = @()
foreach ($f in $ns.Folders.Item(1).Folders) {
  $results += [PSCustomObject]@{
    name = $f.Name
    count = $f.Items.Count
    unread = $f.UnReadItemCount
  }
}
$results | ConvertTo-Json -Compress
`;
  const output = runPowershell(script);
  if (!output) return [];
  return JSON.parse(output);
}
