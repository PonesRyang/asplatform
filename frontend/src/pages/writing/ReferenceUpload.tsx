// @ts-nocheck
import { useState, useRef, type FC } from 'react';
import {
  Upload,
  Button,
  List,
  Tag,
  Typography,
  Space,
  message,
  Card,
  Progress,
} from 'antd';
import {
  InboxOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import type { UploadFile, RcFile } from 'antd/es/upload/interface';
import { uploadReferences } from '../../services/thesisApi';

const { Dragger } = Upload;
const { Text, Title } = Typography;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface VerifiedReference {
  title: string;
  authors: string;
  year: number | null;
  journal: string | null;
  doi: string | null;
  citation: string;
  is_validated: boolean;
  validation_errors: string | null;
}

export interface FailedReference {
  fileName: string;
  reason: string;
}

interface ReferenceUploadProps {
  serviceToken: string;
  projectId: number;
  onReferencesVerified: (verified: VerifiedReference[]) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
const ReferenceUpload: FC<ReferenceUploadProps> = ({
  serviceToken,
  projectId,
  onReferencesVerified,
}) => {
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const rawFilesRef = useRef<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [verifiedRefs, setVerifiedRefs] = useState<VerifiedReference[]>([]);
  const [failedRefs, setFailedRefs] = useState<FailedReference[]>([]);
  const [uploadDone, setUploadDone] = useState(false);

  const handleUpload = async (): Promise<void> => {
    if (fileList.length === 0) {
      message.warning('请先选择文件');
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append('project_id', String(projectId));
      formData.append('token', serviceToken);

      if (rawFilesRef.current.length === 0) {
        message.error('无法读取文件，请重新选择');
        setUploading(false);
        return;
      }
      rawFilesRef.current.forEach((f) => formData.append('files', f));

      // Simulate progress since uploadFiles doesn't expose onUploadProgress
      const progressTimer = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressTimer);
            return 90;
          }
          return prev + 10;
        });
      }, 300);

      const result = await uploadReferences(formData);
      clearInterval(progressTimer);
      setUploadProgress(100);

      const verified = (result.verified ?? []) as VerifiedReference[];
      const failed = (result.failed ?? []) as FailedReference[];

      setVerifiedRefs(verified);
      setFailedRefs(failed.map((f: any) => ({ fileName: f.filename || '未知', reason: f.reason || '未知原因' })));
      setUploadDone(true);

      if (verified.length > 0) {
        message.success(`成功验证 ${verified.length} 篇文献`);
      }
      if (failed.length > 0) {
        failed.forEach((f: any) => message.warning(`${f.filename || '文件'}: ${f.reason || '验证失败'}`));
      }
      if (verified.length === 0 && failed.length === 0) {
        message.info('上传完成但无返回结果');
      }
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : '上传失败，请重试';
      message.error(msg);
      setUploadProgress(0);
    } finally {
      setUploading(false);
    }
  };

  const handleConfirm = (): void => {
    onReferencesVerified(verifiedRefs);
  };

  const handleBeforeUpload = (file: RcFile): boolean => {
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
    ];
    const isAllowed = allowedTypes.includes(file.type);
    if (!isAllowed) {
      message.error('仅支持 PDF、DOCX、DOC 格式文件');
      return Upload.LIST_IGNORE;
    }
    // Store raw file for manual upload
    rawFilesRef.current = [...rawFilesRef.current.filter(f => f.name !== file.name && f.size !== file.size), file];
    return false; // Prevent auto-upload
  };

  return (
    <Card
      title={
        <Space>
          <FileTextOutlined />
          <span>上传参考文献</span>
        </Space>
      }
      style={{ marginBottom: 24 }}
    >
      {!uploadDone ? (
        <>
          <Dragger
            multiple
            fileList={fileList}
            onChange={({ fileList: newList }) => {
              setFileList(newList);
              if (newList.length === 0) rawFilesRef.current = [];
            }}
            beforeUpload={handleBeforeUpload}
            accept=".pdf,.docx,.doc"
            disabled={uploading}
            showUploadList={{ showRemoveIcon: !uploading }}
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
            <p className="ant-upload-hint">
              支持 PDF、Word 格式，单次最多上传 10 个文件
            </p>
          </Dragger>

          {uploading && (
            <div style={{ marginTop: 16 }}>
              <Progress percent={uploadProgress} status="active" />
              <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
                正在上传并解析参考文献...
              </Text>
            </div>
          )}

          <div style={{ marginTop: 16, textAlign: 'right' }}>
            <Button
              type="primary"
              onClick={handleUpload}
              loading={uploading}
              disabled={fileList.length === 0}
              icon={<InboxOutlined />}
            >
              上传并验证
            </Button>
          </div>
        </>
      ) : (
        <>
          {/* Verified references */}
          {verifiedRefs.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <Title level={5}>
                <CheckCircleOutlined
                  style={{ color: '#52c41a', marginRight: 8 }}
                />
                已验证文献 ({verifiedRefs.length})
              </Title>
              <List
                size="small"
                dataSource={verifiedRefs}
                renderItem={(ref) => (
                  <List.Item>
                    <List.Item.Meta
                      title={
                        <Space>
                          <span>{ref.title}</span>
                          <Tag color="success" icon={<CheckCircleOutlined />}>
                            已验证
                          </Tag>
                        </Space>
                      }
                      description={
                        <Space direction="vertical" size={0}>
                          {ref.authors && (
                            <Text type="secondary">
                              作者：{ref.authors}
                              {ref.year ? ` (${ref.year})` : ''}
                            </Text>
                          )}
                          {ref.journal && (
                            <Text type="secondary">
                              期刊：{ref.journal}
                            </Text>
                          )}
                          {ref.doi && (
                            <Text type="secondary">
                              DOI：{ref.doi}
                            </Text>
                          )}
                        </Space>
                      }
                    />
                  </List.Item>
                )}
              />
            </div>
          )}

          {/* Failed references */}
          {failedRefs.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <Title level={5}>
                <CloseCircleOutlined
                  style={{ color: '#ff4d4f', marginRight: 8 }}
                />
                验证失败 ({failedRefs.length})
              </Title>
              <List
                size="small"
                dataSource={failedRefs}
                renderItem={(ref) => (
                  <List.Item>
                    <List.Item.Meta
                      title={
                        <Space>
                          <span>{ref.fileName}</span>
                          <Tag color="error" icon={<CloseCircleOutlined />}>
                            失败
                          </Tag>
                        </Space>
                      }
                      description={
                        <Text type="danger">{ref.reason}</Text>
                      }
                    />
                  </List.Item>
                )}
              />
            </div>
          )}

          <div style={{ marginTop: 16, textAlign: 'right' }}>
            <Space>
              <Button
                onClick={() => {
                  setUploadDone(false);
                  setFileList([]);
                  setVerifiedRefs([]);
                  setFailedRefs([]);
                  setUploadProgress(0);
                }}
              >
                重新上传
              </Button>
              <Button
                type="primary"
                onClick={handleConfirm}
                disabled={verifiedRefs.length === 0}
              >
                确认添加 ({verifiedRefs.length} 篇)
              </Button>
            </Space>
          </div>
        </>
      )}
    </Card>
  );
};

export default ReferenceUpload;
