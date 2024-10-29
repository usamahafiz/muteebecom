
import React, { useState, useEffect } from "react";
import { db, storage } from "../firebase/config";
import { Navbar, Nav, Container } from 'react-bootstrap';
import { FaCartPlus, FaBox, FaHome, FaSignOutAlt, FaShoppingBag  } from 'react-icons/fa';
import { Empty } from "antd"; 

import { writeBatch  } from "firebase/firestore"; 
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  getDoc,
  query,
  where,
} from "firebase/firestore";
import {
  Form,
  Input,
  Button,
  Upload,
  message,
  Card,
  Row,
  Col,
  Typography,
  Layout,
  Menu,
  Modal,
  Grid,
} from "antd";
import {
  UploadOutlined,
  PrinterOutlined,
  DesktopOutlined,
  FileOutlined,
  PieChartOutlined,
  InfoCircleOutlined,
  TeamOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import "../scss/_sellerdashboard.scss";

const { Title , Text} = Typography;
const { Content, Sider  } = Layout;
const { useBreakpoint } = Grid;

const SellerDashboard = () => {
  const { currentUser, signOut } = useAuth();
  const [product, setProduct] = useState({
    name: "",
    category: "",
    price: 0,
    image: null,
  });
  const [editingProduct, setEditingProduct] = useState(null);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [earnings, setEarnings] = useState(0);
  const [loading, setLoading] = useState(false);
  const [activeSection, setActiveSection] = useState("addProduct");
  const [collapsed, setCollapsed] = useState(true);
  const [isModalVisible, setIsModalVisible] = useState(false);

  const navigate = useNavigate();


  useEffect(() => {
    if (currentUser) {
      fetchProducts();
      fetchOrders();
    }
  }, [currentUser]);

  const fetchProducts = async () => {
    try {
      const q = query(
        collection(db, "products"),
        where("sellerUid", "==", currentUser.uid)
      );
      const querySnapshot = await getDocs(q);
      const productList = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setProducts(productList);
    } catch (error) {
      message.error(`Error fetching products: ${error.message}`);
    }
  };
  const handleRemoveAllProducts = async () => {
    try {
      const batch = writeBatch(db); // Create a new batch
      products.forEach((product) => {
        const productRef = doc(db, "products", product.id);
        batch.delete(productRef);
      });
      await batch.commit();
      message.success("All products deleted successfully!");
      fetchProducts(); // Refresh product list
    } catch (error) {
      message.error(`Error deleting products: ${error.message}`);
    }
  };
  
  const handleRemoveAllOrders = async () => {
    try {
      const batch = writeBatch(db); 
      orders.forEach((order) => {
        const orderRef = doc(db, "orders", order.id);
        batch.delete(orderRef);
      });
      await batch.commit();
      message.success("All orders deleted successfully!");
      fetchOrders(); // Refresh order list
    } catch (error) {
      message.error(`Error deleting orders: ${error.message}`);
    }
  };
  
  const fetchOrders = async () => {
    try {
      // Query orders where sellerUid matches the currentUser.uid
      const q = query(
        collection(db, "orders"),
        where("sellerUid", "==", currentUser.uid)
      );
  
      const querySnapshot = await getDocs(q);
  
      const orderList = await Promise.all(
        querySnapshot.docs.map(async (orderDoc) => {
          const orderData = orderDoc.data();
  
          // Log the fetched order data for debugging
          console.log('Fetched Order Data:', orderData);
  
          if (!orderData) {
            console.error('Invalid order data:', orderData);
            return {
              id: orderDoc.id,
              productName: "Unknown",
              productPrice: 0,
              productImage: "",
              buyerEmail: "Unknown",
              status: "Unknown",
              address: "Unknown",
              category: "Unknown",
            };
          }
  
          // Use default values if fields are not present
          return {
            id: orderDoc.id,
            productName: orderData.productName || "Unknown",
            productPrice: parseFloat(orderData.productPrice) || 0,
            productImage: orderData.productImage || "",
            buyerEmail: orderData.buyerEmail || "Unknown",
            status: orderData.status || "Unknown",
            address: orderData.address || "Unknown",
            category: orderData.category || "Unknown",
          };
        })
      );
  
      // Set the state with the fetched orders
      setOrders(orderList);
      
      // Calculate earnings based on the fetched orders
      calculateEarnings(orderList);
  
    } catch (error) {
      console.error(`Error fetching orders: ${error.message}`);
      message.error(`Error fetching orders: ${error.message}`);
    }
  };
  
  const calculateEarnings = (orders) => {
    const totalEarnings = orders.reduce((acc, order) => {
      if (order.status === "Accepted") {
        const priceAfterFees = order.productPrice * (1 - 0.20); // 20% fees (15% GST + 5% app fee)
        return acc + priceAfterFees;
      }
      return acc;
    }, 0);
  
    setEarnings(totalEarnings);
  };
  
  const handleAddProduct = async () => {
    setLoading(true);
    try {
      let imageURL = "";
      if (product.image) {
        const imageRef = ref(
          storage,
          `products/${Date.now()}_${product.image.name}`
        );
        await uploadBytes(imageRef, product.image);
        imageURL = await getDownloadURL(imageRef);
      }

      const productData = {
        name: product.name,
        category: product.category,
        price: product.price,
        image: imageURL,
        sellerUid: currentUser.uid,
      };

      if (editingProduct) {
        await updateDoc(doc(db, "products", editingProduct.id), productData);
        message.success("Product updated successfully!");
        setEditingProduct(null);
      } else {
        await addDoc(collection(db, "products"), productData);
        message.success("Product added successfully!");
      }

      setProduct({ name: "", category: "", price: 0, image: null });
      fetchProducts();
    } catch (error) {
      message.error(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleEditProduct = (record) => {
    setProduct(record);
    setEditingProduct({ id: record.id });
    setIsModalVisible(true);
  };
  const handleDeleteProduct = async (id) => {
    try {
      await deleteDoc(doc(db, "products", id));
      message.success("Product deleted successfully!");
      fetchProducts();
    } catch (error) {
      message.error(`Error: ${error.message}`);
    }
  };

  const handleAcceptOrder = async (orderId) => {
    try {
      const orderRef = doc(db, "orders", orderId);
      const orderDoc = await getDoc(orderRef);
  
      if (orderDoc.exists()) {
        const orderData = orderDoc.data();
        
        // Check if the order status is undefined or 'Pending'
        if (orderData.status === undefined || orderData.status === "Pending") {
          await updateDoc(orderRef, { status: "Accepted" });
  
          // Update earnings
          const priceAfterFees = orderData.productPrice * (1 - 0.20); // 20% fees
          setEarnings((prevEarnings) => prevEarnings + priceAfterFees);
  
          message.success("Order accepted successfully!");
          fetchOrders();
        } else {
          message.error("Order has already been processed.");
        }
      } else {
        message.error("Order not found.");
      }
    } catch (error) {
      message.error(`Error accepting order: ${error.message}`);
    }
  };
  
  
  const handleRejectOrder = async (orderId) => {
    try {
      const orderRef = doc(db, "orders", orderId);
      const orderDoc = await getDoc(orderRef);
  
      if (orderDoc.exists()) {
        const orderData = orderDoc.data();
        
        // Check if the order status is 'Pending' or undefined (allow rejection)
        if (orderData.status === undefined || orderData.status === "Pending") {
          await updateDoc(orderRef, { status: "Rejected" });
  
          message.success("Order rejected successfully!");
          fetchOrders();
        } else {
          message.error("Order has already been processed.");
        }
      } else {
        message.error("Order not found.");
      }
    } catch (error) {
      message.error(`Error rejecting order: ${error.message}`);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
      message.success("Logged out successfully!");
      navigate("/");
    } catch (error) {
      message.error(`Error logging out: ${error.message}`);
    }
  };

 

  const handleModalOk = () => {
    handleAddProduct();
    setIsModalVisible(false);
  };

  const handleModalCancel = () => {
    setIsModalVisible(false);
  };

  return (
    <Layout
      style={{
        minHeight: "100vh",
     
        backgroundSize: "cover",
      }}
    >
      <Navbar bg="light" expand="lg">
        <Container>
          <Navbar.Brand href="#home">
            <FaShoppingBag style={{ marginRight: '8px' }} />
            Shop Nest
          </Navbar.Brand>
          <Navbar.Toggle aria-controls="basic-navbar-nav" />
          <Navbar.Collapse id="basic-navbar-nav">
            <Nav className="mr-auto">
              <Nav.Link href="#" onClick={() => setActiveSection('addProduct')}>
                <FaHome /> Add Product
              </Nav.Link>
              <Nav.Link href="#" onClick={() => setActiveSection('manageProducts')}>
                <FaBox /> Manage Products
              </Nav.Link>
              <Nav.Link href="#" onClick={() => setActiveSection('orders')}>
                <FaCartPlus /> Orders
              </Nav.Link>
              <Nav.Link href="#" onClick={() => setActiveSection('earnings')}>
                Earnings
              </Nav.Link>
            </Nav>
            <Button type="primary" onClick={handleLogout} style={{ backgroundColor: 'green', borderColor: 'green' }}>
              <FaSignOutAlt /> Logout
            </Button>
          </Navbar.Collapse>
        </Container>
      </Navbar>
      <Layout
        style={{
          margin: 0,
          transition: "margin-left 0.2s",
          backgroundColor: 'rgba(0, 0, 0, 0)',
          backgroundSize: "cover",
        }}
      >

      
        <Content
          style={{
            margin: "24px 16px",
            padding: 24,
            minHeight: 280,
           
          }}
        >
         {activeSection === "addProduct" && (
  <div>
    <di style={{ textAlign: 'center', marginBottom: 24 }}>  <Title level={4}> Add New Product</Title>
    </di>
  
    <Card style={{ padding: 24, maxWidth: 600, margin: 'auto' }}>
      <Form
        layout="vertical"
        onFinish={handleAddProduct}
        initialValues={product}
        encType="multipart/form-data"
      >
        <Form.Item label="Product Name" name="name">
          <Input
            value={product.name}
            onChange={(e) =>
              setProduct({ ...product, name: e.target.value })
            }
          />
        </Form.Item>
        <Form.Item label="Category" name="category">
          <Input
            value={product.category}
            onChange={(e) =>
              setProduct({ ...product, category: e.target.value })
            }
          />
        </Form.Item>
        <Form.Item label="Price" name="price">
          <Input
            type="number"
            value={product.price}
            onChange={(e) =>
              setProduct({ ...product, price: e.target.value })
            }
          />
        </Form.Item>
        <Form.Item label="Product Image" name="image">
          <Upload
            beforeUpload={(file) => {
              setProduct({ ...product, image: file });
              return false;
            }}
          >
            <Button icon={<UploadOutlined />}>Upload</Button>
          </Upload>
        </Form.Item>
        <Form.Item>
        <Button
  style={{ 
    backgroundColor: 'green', 
    borderColor: 'green', 
    width: '100%', 
  }}
  htmlType="submit"
  loading={loading}
>
  {editingProduct ? "Update Product" : "Add Product"}
</Button>

        </Form.Item>
      </Form>
    </Card>
  </div>
)}

{activeSection === "manageProducts" && (
  <div>
  <div style={{ display: 'flex', justifyContent: 'center', margin: '20px 0' }}>
  <Button 
    type="danger" 
    onClick={handleRemoveAllProducts} 
    style={{ 
      backgroundColor: 'green', 
      borderColor: 'green', 
      padding: '10px 20px',  
      marginTop: '20px',      
      marginBottom: '20px',   
    }}
  >
    Remove All Products
  </Button>
</div>

    {products.length === 0 ? (
      <Empty description="No products to show" />
    ) : (
      <Row gutter={[16, 16]}>
        {products.map((product) => (
          <Col xs={24} sm={12} md={8} lg={6} key={product.id}>
            <Card
              hoverable
              cover={
                <img
                  alt={product.name}
                  src={product.image}
                  style={{ height: 150, objectFit: 'cover' }}
                />
              }
              style={{ marginBottom: 16 }}
            >
              <Card.Meta
                title={product.name}
                description={`Price: $${product.price}`}
              />
              <Button
                type="primary"
                onClick={() => handleEditProduct(product)}
                style={{ margin: '8px' }}
              >
                Edit
              </Button>
              <Button
                type="danger"
                onClick={() => handleDeleteProduct(product.id)}
                style={{ margin: '8px' }}
              >
                Delete
              </Button>
            </Card>
          </Col>
        ))}
      </Row>
    )}
  </div>
)}

          <Modal
  title="Edit Product"
  visible={isModalVisible}
  onOk={handleModalOk}
  onCancel={handleModalCancel}
  footer={[
    <Button key="back" onClick={handleModalCancel}>
      Cancel
    </Button>,
    <Button
      key="submit"
      type="primary"
      loading={loading}
      onClick={handleModalOk}
    >
      Save
    </Button>,
  ]}
>
  <Form
    layout="vertical"
    initialValues={product}
    onFinish={handleAddProduct}
  >
    <Form.Item
      label="Product Name"
      name="name"
      rules={[{ required: true, message: "Please enter the product name" }]}
    >
      <Input value={product.name} onChange={(e) => setProduct({ ...product, name: e.target.value })} />
    </Form.Item>
    <Form.Item
      label="Category"
      name="category"
      rules={[{ required: true, message: "Please select a category" }]}
    >
      <Input value={product.category} onChange={(e) => setProduct({ ...product, category: e.target.value })} />
    </Form.Item>
    <Form.Item
      label="Price"
      name="price"
      rules={[{ required: true, message: "Please enter the product price" }]}
    >
      <Input
        type="number"
        value={product.price}
        onChange={(e) => setProduct({ ...product, price: parseFloat(e.target.value) })}
      />
    </Form.Item>
    <Form.Item
      label="Product Image"
      name="image"
    >
      <Upload
        beforeUpload={(file) => {
          setProduct({ ...product, image: file });
          return false;
        }}
        showUploadList={false}
      >
        <Button icon={<UploadOutlined />}>Upload</Button>
      </Upload>
    </Form.Item>
  </Form>
</Modal>

    {activeSection === "orders" && (
  <div>
  <div style={{ display: 'flex', justifyContent: 'center', margin: '20px 0' }}>
  <Button 
    type="danger" 
    onClick={handleRemoveAllOrders} 
    style={{ 
      backgroundColor: 'green', 
      borderColor: 'green', 
      padding: '10px 20px',  
      marginTop: '20px',      
      marginBottom: '20px',   
    }}
  >
    Remove All Orders
  </Button>
</div>

    {orders.length === 0 ? (
      <Empty description="No orders to show" />
    ) : (
      <Row gutter={[16, 16]}>
        {orders.map((order) => (
          <Col xs={24} sm={12} md={8} lg={6} key={order.id}>
            <Card
              hoverable
              cover={
                <img
                  alt={order.productName}
                  src={order.productImage}
                  style={{ height: 150, objectFit: 'cover' }}
                />
              }
              style={{ marginBottom: 16 }}
            >
              <Card.Meta
                title={`Order ID: ${order.id}`}
                description={
                  <>
                    <div>Product: {order.productName}</div>
                    <div>Price: ${order.productPrice}</div>
                    <div>Buyer: {order.buyerEmail}</div>
                    <div>Status: {order.status}</div>
                  </>
                }
              />
              <div style={{ marginTop: 16 }}>
                <Button
                  type="primary"
                  onClick={() => handleAcceptOrder(order.id)}
                  style={{ marginRight: 8 }}
                >
                  Accept
                </Button>
                <Button
                  type="danger"
                  onClick={() => handleRejectOrder(order.id)}
                >
                  Reject
                </Button>
              </div>
            </Card>
          </Col>
        ))}
      </Row>
    )}
  </div>
)}


         {activeSection === "earnings" && (
  <div style={{ display: 'flex', justifyContent: 'center', padding: '20px' }}>
    <Card
      title={<Title level={4} style={{ textAlign: 'center' }}>Earnings Overview</Title>}
      extra={
        <Button 
          icon={<PrinterOutlined />} 
          type="default"
          onClick={() => window.print()}
          style={{ marginLeft: 'auto' }}
        >
          Print
        </Button>
      }
      style={{ width: '100%', maxWidth: 800, backgroundColor: '#f5f5f5', position: 'relative' }}
    >
      <Row gutter={[16, 16]}>
        <Col span={12}>
          <Text strong>Total GST (15%):</Text>
          <div style={{ color: '#FF5722' }}>${(earnings * 0.15).toFixed(2)}</div>
        </Col>
        <Col span={12}>
          <Text strong>Total App Tax (5%):</Text>
          <div style={{ color: '#FFC107' }}>${(earnings * 0.05).toFixed(2)}</div>
        </Col>
        <Col span={12}>
          <Text strong>Total Deductions:</Text>
          <div style={{ color: '#2196F3' }}>${(earnings * 0.10).toFixed(2)}</div>
        </Col>
        <Col span={12}>
          <Text strong>Net Earnings:</Text>
          <div style={{ color: '#FF9800' }}>${(earnings - (earnings * 0.30)).toFixed(2)}</div>
        </Col>
        <Col span={12}>
          <Text strong>Total Earnings:</Text>
          <div style={{ color: '#4CAF50' }}>${earnings.toFixed(2)}</div>
        </Col>
      </Row>
      
      <div style={{ 
        position: 'absolute', 
        bottom: 0, 
        left: 0, 
        right: 0, 
        textAlign: 'center', 
        padding: '14px', 
        backgroundColor: '#fff', 
        borderTop: '1px solid #ddd'
      }}>
        <Text style={{ color: '#FF5722', fontSize: '14px' }}>
          <InfoCircleOutlined style={{ marginRight: '8px' }} />
          Notice: Earnings Only Based on Orders Accepted By You <br />
          Not Valid for court
        </Text>
      </div>
    </Card>
  </div>
)}


        </Content>
      </Layout>
    </Layout>
  );
};

export default SellerDashboard;
















